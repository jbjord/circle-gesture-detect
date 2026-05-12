import { DEFAULT_THRESHOLDS } from "../src/config/default-thresholds";
import CircleGestureRecognizer from "../src/recognizer/circle-gesture-recognizer";
import GestureSampler from "../src/sampling/gesture-sampler";

/**
 * Connects sampler and recognizer. 
 * Provides default action suppression. 
 * Emits events.
 * @todo build logic
 */
export default class GestureController {


    constructor(target, thresholds = {}) {
        this.target = target;
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

        this.recognizer = new CircleGestureRecognizer(this.thresholds);
        
        this.sampler = new GestureSampler(
            this.target, 
            this.recognizer,
            {
                onSessionStart: this.#handleSessionStart.bind(this),
                onSessionStop: this.#handleSessionStop.bind(this),
                onCancel: this.#handleCancel.bind(this),
                onReport: this.#handleReport.bind(this),
                onDecision: this.#handleDecision.bind(this)
            }
        )
        
    }

    /**
     * 
     * @param {*} event 
     * @todo
     */
    #handleSessionStart(event) {

    }

    /**
     * 
     * @param {*} event 
     * @todo
     */
    #handleSessionStopt(event) {

    }

    /**
     * 
     * @param {*} event 
     * @todo
     */
    #handleCancel(event) {

    }

    /**
     * 
     * @param {*} event 
     * @todo
     */
    #handleReport(event) {

    }

    /**
     * 
     * @param {*} event 
     * @todo
     */
    #handleDecision(event) {

    }


    /**
     * Return the state machine data of the gesture recognizer.
     * Public API?
     * @todo
     */
    getGestureState() {

    }

    /**
     * Emit events from the target element.
     * @todo
     * @param {string} name 
     * @param {object} detail 
     */
    #emit(name, detail = {}) {
        this.target.dispatchEvent(new CustomEvent(name, { detail }));
    }
}
