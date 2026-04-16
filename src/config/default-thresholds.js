/**
 * Default thresholds for circle gesture detection.
 *
 * @typedef {object} CircleGestureThresholds
 * @property {number} dejitterDistance - Minimum movement before logging a 
 * subsequent point.
 * @property {number} minDiameter - Minimum diameter for a valid circle.
 * @property {number} maxDiameter - Maximum diameter for a valid circle.
 * @property {number} minSamples - Minimum number of samples required before 
 * classification can begin. May be used alone or together with `minDistance`.
 * @property {number} minDistance - Minimum distance required before 
 * classification can begin. May be used alone or together with `minSamples`.
 * @property {number} maxReversals - Maximum number of direction changes 
 * (clockwise <--> counterclockwise) allowed before rejecting gesture.
 * @property {number} centroidCalcAngleAccum
 *   Threshold of accumulated signed turn (in degrees) after which the 
 *   centroid of the circle may be calculated.
 * @property {number} completeAngleAccum
 *   Threshold of accumulated signed turn (in degrees) that can be considered
 *   as a complete circle.
 * 
 * FUTURE: Consider adding
 * circularityTolerance - Allowed variance in radius.
 * closureDistance - Max distance between start/end to count as closed.
 * 
 * @description
 * Classification is intended to begin only after both `minSamples` and 
 * `minDistance` have been satisfied. 
 *  - If only one is specified, then that governs.
 *  - If both are specified, classification waits for the later of the two 
 * conditions to be met.
 */

/**
 * @type {CircleGestureThresholds}
 */
export const DEFAULT_THRESHOLDS = {
    dejitterDistance: 3,
    minDiameter: 20,
    maxDiameter: 1080,
    minSamples: 5,
    minDistance: 5,
    maxReversals: 2,
    centroidCalcAngleAccum: 180,
    completeAngleAccum: 330
};
