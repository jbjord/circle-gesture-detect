/**
 * Thresholds for circle gesture detection.
 *
 * @typedef {object} CircleGestureThresholds
 * @property {number} dejitterDistance - Minimum movement before logging a 
 * subsequent point.
 * @property {number} minDiameter - Minimum diameter for a valid circle.
 * @property {number} maxDiameter - Maximum diameter for a valid circle.
 * @property {number|null} minSamples - Minimum number of samples required before 
 * classification can begin. May be used alone or together with `minDistance`.
 * @property {number|null} minDistance - Minimum distance required before 
 * classification can begin. May be used alone or together with `minSamples`.
 * @property {number} maxReversals - Maximum number of direction changes 
 * (clockwise <--> counterclockwise) allowed before rejecting gesture.
 * @property {number} centroidCalcAngleAccum
 *   Threshold of accumulated signed turn (in degrees) after which the 
 *   centroid of the circle may be calculated. If the angle is too small,
 *   the centroid calculation will be biased towards the arc.
 * @property {number} completeAngleAccum
 *   Threshold of accumulated signed turn (in degrees) that can be considered
 *   as a complete circle.
 * @property {number|null} circularityTolerance
 *   Allowed variance in radius.
 * @property {number|null} closureDistancePx
 *   Maximum distance between start and end points in px. May be used alone 
 *   or together with `closureDistanceRadiusRatio`
 * @property {number|null} closureDistanceRadiusRatio
 *   Maximum distance between start and end points defined as a fraction of the 
 *   final calculated radius. May be used alone or together with 
 *   `closureDistancePx`
 * 
 * @description
 * Classification is intended to begin only after both `minSamples` and 
 * `minDistance` have been satisfied. 
 *  - If only one is specified, then that governs.
 *  - If both are specified, classification waits for the later of the two 
 * conditions to be met.
 * For closure thresholds `closureDistancePx` and `closureDistanceRadiusRatio`:
 *  - If both are null, then there is effectively no closure distance threshold.
 *  - If only one is specified, then that governs.
 *  - If both are specified, the effective threshold is the **larger** of:
 *     - `closureDistancePx`
 *     - `closureDistanceRadiusRatio`
 */

/**
 * Default thresholds for circle gesture detection.
 * @type {CircleGestureThresholds}
 */
export const DEFAULT_THRESHOLDS = {
    dejitterDistance: 2.5,
    minDiameter: 20,
    maxDiameter: 1080,
    minSamples: 5,
    minDistance: 5,
    maxReversals: 2,
    centroidCalcAngleAccum: 180,
    completeAngleAccum: 330,
    circularityTolerance: 0.18,
    closureDistancePx: null,
    closureDistanceRadiusRatio: null
};
