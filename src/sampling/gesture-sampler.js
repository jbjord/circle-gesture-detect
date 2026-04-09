//@todo add imports

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
     * @param {object} options
     * @param {number} options.dejitterDistance
     * @param {number} options.minDiameter
     * @param {number} options.maxDiameter
     * @todo #1 Pass proper parameters to CircleGestureRecognizer
     * @todo Add more parameters
     */
    constructor(target, {
        dejitterDistance = 3,
        minDiameter = 20,
        maxDiameter = 1080
    } = {}) {
        this.target = target;
        //@todo #1 Pass proper parameters
        this.recognizer = new CircleGestureRecognizer();

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
     * @todo
     */
    #onPointerDown(e) {

    }

    /**
     * @todo
     */
    #onPointerMove(e) {

    }

    /**
     * @todo
     */
    #onPointerUp(e) {

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
