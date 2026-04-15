import PointSample from "../model/point-sample.js"
import { DEFAULT_THRESHOLDS } from "../config/default-thresholds.js";

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
     * @param {CircleGestureThresholds} [thresholds] - thresholds for detection
     */
    constructor(target, thresholds = {}) {
        this.target = target;
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        
        this.recognizer = new CircleGestureRecognizer(this.thresholds);

        this.#pointerId = null;

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
        this.target.removeEventListener("pointerdown", this.#onPointerDown);
        this.target.removeEventListener("pointermove", this.#onPointerMove);
        this.target.removeEventListener("pointerup", this.#onPointerUp);
        this.target.removeEventListener("pointercancel", this.#onPointerUp);
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

        this.#pointerId = e.pointerId;
        const p = new PointSample(e.clientX, e.clientY, e.timeStamp);
        this.recognizer.start(p);
    }

    /**
     * Handle PointerMove event by adding point and disabling default actions 
     * and emitting events as appropriate
     * @param {PointerEvent} e  
     * @todo Add more logic
     */
    #onPointerMove(e) {
        if (this.#pointerId !== null) return;

        this.recognizer.addPoint(e.clientX, e.clientY, e.timeStamp);

        //@todo add logic here to 
        // - disable default actions on target when appropriate
        // - emit circle complete event?
        // - emit definitely-not-a-circle event

    }

    /**
     * Handle PointerUp event by adding final point.
     * Other logic needs to be implemented.
     * @param {PointerEvent} e 
     * @todo Add more logic
     */
    #onPointerUp(e) {
        if (this.#pointerId !== null) return;

        this.recognizer.addPoint(e.clientX, e.clientY, e.timeStamp);

        //@todo add logic here to
        // - do a final check of thresholds
        // - disable default actions on target when appropriate
        // - emit circle complete event?
        // - change recognizer to idle state?
        
    }

    /**
     * @todo
     */
    #onPointerCancel(e) {

    }

    /**
     * Return the state machine data of the gesture recognizer.
     * @todo
     */
    getGestureState() {

    }

    /**
     * Emit events from the target element.
     * @todo
     * @param {*} name 
     * @param {*} detail 
     */
    #emit(name, detail = {}) {
        this.target.dispatchEvent(new CustomEvent(name, { detail }));
    }

}
