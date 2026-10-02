import Dispatch

/// Main-thread callbacks AppKit hands over as plain closures (timers, event monitors, mouse events)
/// enter the main actor here. `MainThread.run` asks the Swift runtime who the current
/// executor is, and on macOS 27 that question crashed the installed app from the dock's cursor timer
/// after an hour and a half of running (SIGSEGV in swift_task_isMainExecutorImpl, 2026-10-02 11:11).
/// libdispatch answers the same question without the runtime.
public enum MainThread {
    public static func run<T>(_ work: @MainActor () throws -> T) rethrows -> T {
        dispatchPrecondition(condition: .onQueue(.main))
        return try withoutActuallyEscaping(work) { try unsafeBitCast($0, to: (() throws -> T).self)() }
    }
}
