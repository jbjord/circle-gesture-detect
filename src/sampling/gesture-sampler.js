import PointSample from "../model/point-sample.js"
import { DEFAULT_THRESHOLDS } from "../config/default-thresholds.js";
import CircleGestureRecognizer from "../recognizer/circle-gesture-recognizer.js";

/**
 * Handle DOM pointer events, feed them into CircleGestureRecognizer,
 * and manage default-action suppression.
 * @todo default-action suppression
 */
export default class GestureSampler {
    #pointerId = null;

    // private fields for bound handlers
    #boundPointerDown;
    #boundPointerMove;
    #boundPointerUp;
    #boundPointerCancel;

    /**
     * @param {HTMLElement|Document} target 
     * @param {CircleGestureRecognizer} recognizer
     */
    constructor(target, recognizer, callbacks) {
        this.target = target;
        this.recognizer = recognizer;

        /**
         * Whether the gesture decision has been made or not
         * @type {boolean}
         */
        this.decisionMade = false;

        this.#pointerId = null; //????

        this.onSessionStart = callbacks.onSessionStart;
        this.onReport = callbacks.onReport;
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
     * @param {PointerEvent} e 
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
     * @param {PointerEvent} e 
     */
    #onPointerMove(e) {
        if (this.decisionMade) return;
        if (this.#pointerId !== e.pointerId) return;
        
        const point = new PointSample(e.clientX, e.clientY, e.timeStamp);
        const report = this.recognizer.send("POINT_ADDED", {point});

        this.#handleReport(report, point, e);
    }

    /**
     * Handle PointerUp event by adding final point and reporting
     * @param {PointerEvent} e 
     * @todo Add more logic
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
            reason: this.decisionMade ? "decision" : "pointerup",
            report,
            point,
            rawEvent: e
        });
        
        this.decisionMade = false;
        this.#pointerId = null;
    }

    /**
     * Handle PointerCancel event.
     * @param {PointerEvent} e 
     */
    #onPointerCancel(e) {
        if (this.#pointerId !== e.pointerId) return;

        this.onCancel?.({ rawEvent: e });

        this.decisionMade = false;
        this.#pointerId = null;
    }

    /**
     * Handles the gesture recognizer report
     * @param {CircleReport|CircleRejectedReport|null} report 
     * @param {PointSample} point 
     * @param {PointerEvent} rawEvent 
     * @returns 
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
