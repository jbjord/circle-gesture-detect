import PointSample from "../model/point-sample.js"
import CircleGestureRecognizer from "../recognizer/circle-gesture-recognizer.js";

/**
 * Payload passed to onSessionStart callback.
 * @typedef {Object} GestureSessionStartEvent
 * @property {PointSample} point - First sample of the gesture.
 * @property {CircleReport|CircleRejectedReport|null} report
 *   Initial report from the recognizer, if any.
 * @property {PointerEvent} rawEvent - Source pointerdown event.
 */

/**
 * Payload passed to onReport callback.
 * @typedef {Object} GestureReportEvent
 * @property {CircleReport|CircleRejectedReport} report - Recognizer report.
 * @property {PointSample} point - Sample that triggered this report.
 * @property {PointerEvent} rawEvent - Source pointer event.
 */

/**
 * Payload passed to onDecision callback.
 * @typedef {Object} GestureDecisionEvent
 * @property {"acceptCircle"|"rejectCircle"} reason - Terminal decision code.
 * @property {CircleReport|CircleRejectedReport} report - Final recognizer report.
 * @property {PointSample} point - Sample at which the decision was made.
 * @property {PointerEvent} rawEvent - Source pointer event.
 */

/**
 * Payload passed to onSessionStop callback.
 * @typedef {Object} GestureSessionStopEvent
 * @property {"acceptCircle"|"rejectCircle"|"pointerup"} reason
 *   Reason the gesture session ended.
 * @property {CircleReport|CircleRejectedReport|null} report
 *   Final report if available, otherwise null.
 * @property {PointSample|null} point
 *   Last sample seen, or null if no final sample was added.
 * @property {PointerEvent} rawEvent - Source pointerup event.
 */

/**
 * Payload passed to onCancel callback.
 * @typedef {Object} GestureCancelEvent
 * @property {PointerEvent} rawEvent - Source pointercancel event.
 */

/**
 * Callbacks used by GestureSampler to report lifecycle events.
 * All fields are optional.
 * @typedef {Object} GestureSamplerCallbacks
 * @property {(e: GestureSessionStartEvent) => void} [onSessionStart]
 * @property {(e: GestureReportEvent) => void} [onReport]
 * @property {(e: GestureDecisionEvent) => void} [onDecision]
 * @property {(e: GestureSessionStopEvent) => void} [onSessionStop]
 * @property {(e: GestureCancelEvent) => void} [onCancel]
 */

/**
 * Handle DOM pointer events, feed them into CircleGestureRecognizer.
 *  - Tracks a single active pointer via pointerId.
 *  - Stops feeding the recognizer after accept/reject decision.
 *  - Reports lifecycle & recognizer events through callbacks.
 */
export default class GestureSampler {
    #pointerId = null;

    // private fields for bound handlers
    #boundPointerDown;
    #boundPointerMove;
    #boundPointerUp;
    #boundPointerCancel;

    /**
     * Create a GestureSampler bound to target el and recognizer.
     * @param {HTMLElement|Document} target 
     *   Element/Document to listen on for pointer events.
     * @param {CircleGestureRecognizer} recognizer
     *   Recognizer that will recieve gesture events.
     * @param {GestureSamplerCallbacks} [callbacks={}]
     *   Optional callbacks invoked as the gesture progresses.
     */
    constructor(target, recognizer, callbacks = {}) {
        this.target = target;
        this.recognizer = recognizer;

        /**
         * Whether the gesture decision has been made or not
         * @type {boolean}
         */
        this.decisionMade = false;

        this.onSessionStart = callbacks.onSessionStart;
        this.onReport = callbacks.onReport;
        this.onDecision = callbacks.onDecision;
        this.onSessionStop = callbacks.onSessionStop;
        this.onCancel = callbacks.onCancel;

        this.#boundPointerDown = this.#onPointerDown.bind(this);
        this.#boundPointerMove = this.#onPointerMove.bind(this);
        this.#boundPointerUp = this.#onPointerUp.bind(this);
        this.#boundPointerCancel = this.#onPointerCancel.bind(this);

        target.addEventListener("pointerdown", this.#boundPointerDown);
        target.addEventListener("pointermove", this.#boundPointerMove);
        target.addEventListener("pointerup", this.#boundPointerUp);
        target.addEventListener("pointercancel", this.#boundPointerCancel);
    }

    /**
     * Removes event listeners associated with this GestureSampler.
     */
    destroy() {
        this.target.removeEventListener("pointerdown", this.#boundPointerDown);
        this.target.removeEventListener("pointermove", this.#boundPointerMove);
        this.target.removeEventListener("pointerup", this.#boundPointerUp);
        this.target.removeEventListener("pointercancel", this.#boundPointerCancel);
    }

    /**
     * Handle PointerDown event by starting recognizer.
     * Emits onSessionStart.
     * Emits onReport if a report is returned.
     * @param {PointerEvent} e 
     * @private
     */
    #onPointerDown(e) {
        if (this.#pointerId !== null) {
            //ignore multi-touch
            return;
        }

        this.decisionMade = false;
        this.#pointerId = e.pointerId;

        const point = new PointSample(e.clientX, e.clientY, e.timeStamp);
        const report = this.recognizer.send("START", {point});

        this.onSessionStart?.({point, report, rawEvent: e});
        if (report) {
            this.onReport?.({point, report, rawEvent: e});
        }
    }

    /**
     * Handle PointerMove event by adding point and reporting as appropriate.
     * Emits onReport.
     * Emits onDecision if recognizer reaches a decision.
     * @param {PointerEvent} e 
     * @private
     */
    #onPointerMove(e) {
        if (this.decisionMade) return;
        if (this.#pointerId !== e.pointerId) return;
        
        const point = new PointSample(e.clientX, e.clientY, e.timeStamp);
        const report = this.recognizer.send("POINT_ADDED", {point});

        this.#handleReport(report, point, e);
    }

    /**
     * Handle PointerUp event by adding final point and reporting.
     * Emits onSessionStop.
     * Emits onDecision if recognizer reaches a decision.
     * @param {PointerEvent} e 
     * @private
     */
    #onPointerUp(e) {
        if (this.#pointerId !== e.pointerId) return;

        let report = null;
        let point = null;

        if (!this.decisionMade) {
            point = new PointSample(e.clientX, e.clientY, e.timeStamp);
            report = this.recognizer.send("END", {point});
            this.#handleReport(report, point, e);
        }

        this.onSessionStop?.({
            reason: report?.decision ?? "pointerup",
            report,
            point,
            rawEvent: e
        });
        
        this.decisionMade = false;
        this.#pointerId = null;
    }

    /**
     * Handle PointerCancel event.
     * Emits onCancel.
     * @param {PointerEvent} e 
     * @private
     */
    #onPointerCancel(e) {
        if (this.#pointerId !== e.pointerId) return;

        this.onCancel?.({ rawEvent: e });

        this.decisionMade = false;
        this.#pointerId = null;
    }

    /**
     * Handles the gesture recognizer report.
     * Emits onReport for non-null reports.
     * Emits onDecision once per session when accept/reject is decided.
     * @param {CircleReport|CircleRejectedReport|null} report 
     * @param {PointSample} point 
     * @param {PointerEvent} rawEvent 
     * @private
     */
    #handleReport(report, point, rawEvent) {
        if (!report) return;

        this.onReport?.({ report, point, rawEvent });

        if (report.decision && !this.decisionMade) {
            this.decisionMade = true;

            this.onDecision?.({
                reason: report.decision, 
                report, 
                point, 
                rawEvent
            });
        }
    }

}
