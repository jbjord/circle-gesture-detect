/**
 * Default thresholds for circle gesture detection.
 *
 * @typedef {object} CircleGestureThresholds
 * @property {number} dejitterDistance - Minimum movement before logging a point.
 * @property {number} minDiameter - Minimum diameter for a valid circle.
 * @property {number} maxDiameter - Maximum diameter for a valid circle.
 * @property {number} minSamples - Minimum number of samples before classification.
 * @property {number} maxReversals - Maximum number of changes in counter/clockwise direction.
 * Consider adding
 * circularityTolerance - Allowed variance in radius.
 * closureDistance - Max distance between start/end to count as closed.
 */

/**
 * @type {CircleGestureThresholds}
 */
export const DEFAULT_THRESHOLDS = {
    dejitterDistance: 3,
    minDiameter: 20,
    maxDiameter: 1080,
    minSamples: 5,
    maxReversals: 2
};
