import CoreGraphics
import Foundation
import UCore

/// The face moves like on Windows: grab, drag, throw, two fingers (2026-09-30, asked by the user).
extension AgentTests {
    private var work: CGRect { CGRect(x: 0, y: 25, width: 1470, height: 900) }
    private func face(x: Double, y: Double) -> CGRect { CGRect(x: x, y: y, width: 90, height: 90) }

    func testTapIsNotDrag() {
        XCTAssertEqual(FaceFling.isDrag(dx: 12, dy: 0), false)
        XCTAssertEqual(FaceFling.isDrag(dx: 9, dy: 9), false)
        XCTAssertEqual(FaceFling.isDrag(dx: 14, dy: 0), true)
    }

    func testDroppedFaceGoesToNearestSideAndKeepsHeight() {
        let left = FaceFling.landing(frame: face(x: 400, y: 300), workArea: work, vx: 300, vy: 0)
        XCTAssertEqual(left.origin, CGPoint(x: 0, y: 300))
        XCTAssertEqual(left.crossed, false)
        let right = FaceFling.landing(frame: face(x: 900, y: 300), workArea: work, vx: -300, vy: 0)
        XCTAssertEqual(right.origin, CGPoint(x: 1380, y: 300))
    }

    func testOnlyAHorizontalThrowCrosses() {
        let thrown = FaceFling.landing(frame: face(x: 300, y: 300), workArea: work, vx: 1200, vy: 200)
        XCTAssertEqual(thrown.origin.x, 1380)
        XCTAssertEqual(thrown.crossed, true)
        let vertical = FaceFling.landing(frame: face(x: 300, y: 300), workArea: work, vx: 1000, vy: -1500)
        XCTAssertEqual(vertical.origin.x, 0)
        XCTAssertEqual(vertical.crossed, false)
    }

    func testForceDecidesHowFarTheHeightTravelsAndNeverLeavesTheScreen() {
        let weak = FaceFling.landing(frame: face(x: 0, y: 100), workArea: work, vx: 0, vy: 500)
        let strong = FaceFling.landing(frame: face(x: 0, y: 100), workArea: work, vx: 0, vy: 2000)
        XCTAssertEqual(weak.origin.y, 210)
        XCTAssertEqual(strong.origin.y > weak.origin.y, true)
        let wild = FaceFling.landing(frame: face(x: 0, y: 800), workArea: work, vx: 0, vy: 9000)
        XCTAssertEqual(wild.origin.y, work.maxY - 90)
    }

    func testFlightDurationFollowsDistanceWithinBounds() {
        let short = FaceFling.landing(frame: face(x: 30, y: 300), workArea: work, vx: 0, vy: 0)
        let long = FaceFling.landing(frame: face(x: 300, y: 300), workArea: work, vx: 2000, vy: 0)
        XCTAssertEqual(short.duration >= 0.32 && short.duration <= 1.2, true)
        XCTAssertEqual(long.duration >= 0.32 && long.duration <= 1.2, true)
        XCTAssertEqual(FaceFling.landing(frame: face(x: 700, y: 300), workArea: work, vx: 0, vy: 0).duration
                       > FaceFling.landing(frame: face(x: 200, y: 300), workArea: work, vx: 0, vy: 0).duration, true)
        XCTAssertEqual(FaceFling.landing(frame: face(x: 0, y: 300), workArea: work, vx: 0, vy: 0).duration, 0)
    }

    func testFlightStartsWhereReleasedLandsExactlyAndArcsUp() {
        let start = CGPoint(x: 300, y: 300)
        let landing = FaceFling.landing(frame: face(x: 300, y: 300), workArea: work, vx: 1500, vy: 0)
        let first = FaceFling.position(from: start, landing: landing, at: 0)
        XCTAssertEqual(abs(first.x - start.x) < 0.001 && abs(first.y - start.y) < 0.001, true)
        XCTAssertEqual(FaceFling.position(from: start, landing: landing, at: 1), landing.origin)
        XCTAssertEqual(FaceFling.position(from: start, landing: landing, at: 0.5).y < 300, true)
        var previous = start.x, monotonic = true
        for step in 1...60 {
            let x = FaceFling.position(from: start, landing: landing, at: Double(step) / 60).x
            if x < previous - 0.001 { monotonic = false }
            previous = x
        }
        XCTAssertEqual(monotonic, true)
    }

    func testReleaseSpeedCarriesIntoTheFlight() {
        let calm = FaceFling.spring(0.05, slope: 0)
        let thrown = FaceFling.spring(0.05, slope: 2.2)
        XCTAssertEqual(thrown > calm, true)
        XCTAssertEqual(abs(FaceFling.spring(1, slope: 2.2) - 1) < 1e-9, true)
    }

    func testVelocityFollowsTheTrajectory() {
        var velocity = FaceVelocity()
        velocity.reset(at: .zero, time: 0)
        for step in 1...40 { velocity.sample(CGPoint(x: Double(step) * 10, y: 0), time: Double(step) * 0.01) }
        XCTAssertEqual(abs(velocity.vx - 1000) < 5, true)
        velocity.sample(CGPoint(x: 405, y: 0), time: 0.411)
        XCTAssertEqual(velocity.vx > 800, true)
    }

    func testTwoFingerThrowUsesOnlyTheEndOfTheGesture() {
        var fling = ScrollFling()
        for step in 0..<50 { fling.add(dx: 2, dy: 0, at: Double(step) * 0.01) }
        for step in 50..<60 { fling.add(dx: 30, dy: 0, at: Double(step) * 0.01) }
        let v = fling.finish(at: 0.6, pause: 0)
        XCTAssertEqual(v.vx > 1500, true)
        var slow = ScrollFling()
        slow.add(dx: 5, dy: 5, at: 0)
        XCTAssertEqual(slow.finish(at: 0.5, pause: FaceFling.scrollPause).vx, 0)
    }
}
