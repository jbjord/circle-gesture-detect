import PointSample from "./point-sample";

/**
 * Rotational direction of gesture.
 * @typedef {"straight"|"counterclockwise"|"clockwise"} Direction
 */

/**
 * Log of sampled points for a gesture.
 * @class
 */
export default class SampleLog {
    #minX;
    #maxX;
    #minY;
    #maxY;

    /**
     * Stores sampled points of the gesture.
     *  - .log are the logged points after de-jittering
     *  - .rawLog are all points
     * @param {PointSample} start - starting point for this sample log
     * @param {number} minStep - minimum distance between subsequent logged points
     * Used for de-jittering.
     * @param {object} [options] - Optional configuration.
     * @param {number} [options.minSamples] - Minimum number of logged samples 
     * required before classification may begin. May be used alone or together 
     * with `minDistance`.
     * @param {number} [options.minDistance] - Minimum total path distance 
     * required before classification may begin. May be used alone or together 
     * with `minSamples`.
     * 
     * @description
     * Classification is intended to begin only after both `minSamples` and 
     * `minDistance` have been satisfied. 
     *  - If only one is specified, then that governs.
     *  - If both are specified, classification waits for the later of the two 
     * conditions to be met.
     */
    constructor(start, minStep, {
        minSamples = undefined,
        minDistance = undefined
    } = {}) {
        /**
         * Starting point
         * @type {PointSample}
         */
        this.start = start;
        this.minStep = minStep;

        this.minSamples = minSamples;
        this.minDistance = minDistance;


        this.pathLength = 0;

        //directional metrics
        this.clockwiseLength = 0;
        this.counterClockwiseLength = 0;
        this.mostRecentDirection = null;
        this.directionChangeCount = 0;

        //angular metrics
        this.totalTurn = 0; //accumulated signed angle
        this.totalAbsTurn = 0; //sum of all angle changes

        //logs of PointSamples
        this.rawLog = [start]; //all points logged
        this.log = [start]; //de-jittered points

        //chord metrics
        this.chord = {
            dx: 0,
            dy: 0,
            length: 0
        };

        this.maxDeviationPx = 0;
        this.maxDeviationRatio = 0;
        this.straightnessRatio = 0;

        //set initial min/max bounding coords
        this.#minX = start.x;
        this.#maxX = start.x;
        this.#minY = start.y;
        this.#maxY = start.y;
    }


    /**
     * Add a PointSample to the log with de-jittering based on this.minStep.
     * Subsequent points have to be at least this.minStep distance away.
     * @overload
     * @param {PointSample} point - The point to add.
     * @returns {boolean} Whether point was added to log or not.
     */

    /**
     * Add a point (xy-coord + timestamp) to the log with de-jittering based 
     * on this.minStep.
     * Subsequent points have to be at least this.minStep distance away.
     * @overload
     * @param {number} x - x-coordinate.
     * @param {number} y - y-coordinate.
     * @param {number} t - timestamp.
     * @returns {boolean} Whether point was added to log or not.
     */

    /**
     * Implementation of the overloaded add() method.
     * @param {PointSample|number} a
     * @param {number} [b]
     * @param {number} [c]
     * @returns {boolean}
     */
    add(a, b, c) {
        let point;
        // add(PointSample)
        if (a instanceof PointSample) {
            point = a;
        }
        // add(x, y, t)
        else {
            point = new PointSample(a, b, c);
        }

        this.rawLog.push(point);

        const prev = this.log[this.log.length - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const step = Math.hypot(dx, dy);

        //dejitter: next logged point has to be > minSteps away from prev
        if (step < this.minStep) {
            return false;
        }
        
        this.pathLength += step;

        this.log.push(point);

        this.#updateDirectionalMetrics(step);
        this.#updateAngularMetrics();
        this.#updateMinMaxCoords(point);
        this.#updateChordMetrics();
        this.#updateLinearityMetrics();
        return true;    
    }

    /**
     * Return the point from the log in the negative index position.
     * Examples: fromLast() gives last element
     *           fromLast(2) gives second to last element
     *           fromLast(3) gives third to last element
     * @param {number} [n = 1] negative index from array end 
     * @returns {PointSample}
     */
    fromLast(n = 1) {
        const index = this.log.length - n;
        return index >= 0 ? this.log[index] : undefined;
    }


    /**
     * Returns the distance between starting and last logged points.
     * @returns {number} Euclidean distance between start & last
     */
    distanceFromStart() {
        return this.start.distance(this.log[this.log.length - 1]);
    }

    /**
     * Returns dot & cross products given three points a -> b -> c.
     * @param {PointSample} a - 2nd from last point.
     * @param {PointSample} b - Penultimate point.
     * @param {PointSample} c - Latest point.
     * @returns {dot: number, cross: number} - dot- and cross-products.
     */
    #vectorProducts(a, b, c) {
        const deltaAB = this.#getDeltas(a, b);
        const deltaBC = this.#getDeltas(b, c);

        const dotProduct = deltaAB.x * deltaBC.x + deltaAB.y * deltaBC.y;
        const crossProduct = deltaAB.x * deltaBC.y - deltaAB.y * deltaBC.x;

        return { dot: dotProduct, cross: crossProduct}
    }

    /**
     * Calculates differences in coordinates and optionally time.
     * @param {PointSample} a - start point.
     * @param {PointSample} b - end point.
     * @param {boolean} calculateDeltaT - whether deltaT should be calculated or not.
     * @returns {PointSample} - With difference in x, in y, and optionally in t
     * (or null if calculateDeltaT=false).
     */
    #getDeltas(a, b, calculateDeltaT=false) {
        const deltaX = b.x -a.x;
        const deltaY = b.y - a.y;
        let deltaT = null;
        if (calculateDeltaT) {
            deltaT = b.t - a.t; 
        }
        return new PointSample(deltaX, deltaY, deltaT);
    }

    /**
     * Return counter/clockwise direction of latest three points.
     *
     * Overloads:
     *
     * @overload
     * @method #getClockwiseDirection
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {{ epsilon?: number }} options
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {PointSample} a
     * @param {PointSample} b
     * @param {PointSample} c
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @overload
     * @method #getClockwiseDirection
     * @param {PointSample} a
     * @param {PointSample} b
     * @param {PointSample} c
     * @param {{ epsilon?: number }} options
     * @returns {"straight"|"counterclockwise"|"clockwise"}
     *
     * @param {...any} args Internal implementation (do not call directly with args array).
     * @private
     */
    #getClockwiseDirection(...args) {
        let a, b, c;
        let epsilon = 0.001;

        const isOptionsObject = (value) =>
            value != null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            ("epsilon" in value);

        if (args.length === 0) {
            if (this.log.length < 3) return "straight";
            [a, b, c] = this.log.slice(-3);
        } else if (args.length === 1 && isOptionsObject(args[0])) {
            ({ epsilon = 0.001 } = args[0]);
            if (this.log.length < 3) return "straight";
            [a, b, c] = this.log.slice(-3);
        } else if (args.length === 3) {
            [a, b, c] = args;
        } else if (args.length === 4 && isOptionsObject(args[3])) {
            [a, b, c] = args;
            ({ epsilon = 0.001 } = args[3]);
        } else {
            console.warn("#getClockwiseDirection requires (), ({epsilon}), (a,b,c), or (a,b,c,{epsilon})");
            return "straight";
        }

        if (!a || !b || !c) {
            return "straight";
        }

        const cross = this.#vectorProducts(a, b, c).cross;

        if (cross > epsilon) {
            return "counterclockwise";
        }
        if (cross < -epsilon) {
            return "clockwise";
        }
        return "straight";
    }


    /**
     * Update all directional metrics: this.mostRecentDirection, 
     * this.clockwiseLength, this.counterclockwiseLength, 
     * & this.directionChangeCount
     * @param {number} distance - step distance from previous logged point.
     */
    #updateDirectionalMetrics(distance) {
        const currentDirection = this.#getClockwiseDirection();

        // Guard against impossible values
        if (
            currentDirection !== "straight" &&
            currentDirection !== "clockwise" &&
            currentDirection !== "counterclockwise"
        ) {
            console.warn(
                "direction must be 'counterclockwise', 'clockwise', or 'straight'"
            );
            return;
        }

        // Existence check: just set baseline and bail
        if (!this.mostRecentDirection) {
            this.mostRecentDirection = currentDirection;
            if (currentDirection === "counterclockwise") {
                this.counterClockwiseLength += distance;
            } else if (currentDirection === "clockwise") {
                this.clockwiseLength += distance;
            }
            return;
        }

        // Same direction as last time, or both straight
        if (
            currentDirection === "straight" ||
            currentDirection === this.mostRecentDirection
        ) {
            if (this.mostRecentDirection === "counterclockwise") {
                this.counterClockwiseLength += distance;
            } else if (this.mostRecentDirection === "clockwise") {
                this.clockwiseLength += distance;
            }
            //add nothing if both straight
            return;
        }

        // Direction changed (and is not straight here)
        this.directionChangeCount += 1;
        if (currentDirection === "counterclockwise") {
            this.counterClockwiseLength += distance;
        } else if (currentDirection === "clockwise") {
            this.clockwiseLength += distance;
        }
        this.mostRecentDirection = currentDirection;
    }


    /**
     * Update minimum & maximum bounding coordinates: this.#minX, this.#maxX,
     * this.#minY, and this.#maxY
     * @param {PointSample} point
     */
    #updateMinMaxCoords(point) {
        if (point.x < this.#minX) {
            this.#minX = point.x;
        } else if (point.x > this.#maxX) {
            this.#maxX = point.x;
        }

        if (point.y < this.#minY) {
            this.#minY = point.y;
        } else if (point.y > this.#maxY) {
            this.#maxY = point.y;
        }
    }

    #updateAngularMetrics() {
        if (this.log.length < 3) return;
        
        const [a, b, c] = this.log.slice(-3);

        const { cross, dot } = this.#vectorProducts(a, b, c);

        // signed turn in [-PI, PI]
        const dTheta = Math.atan2(cross, dot);

        this.totalTurn += dTheta;
        this.totalAbsTurn += Math.abs(dTheta);
    }

    /**
     * Updates current line metrics from start to last point.
     */
    #updateChordMetrics() {
        const end = this.fromLast();

        this.chord.dx = end.x - this.start.x;
        this.chord.dy = end.y - this.start.y;
        this.chord.length = Math.hypot(this.chord.dx, this.chord.dy);

        this.straightnessRatio = this.pathLength > 0 
          ? this.chord.length / this.pathLength
          : 0;
    }

    /**
     * Updates linearity metrics for looks-like-a-line early rejection. 
     */
    #updateLinearityMetrics() {
        if (this.log.length < 3 || this.chord.length === 0 || this.pathLength === 0) {
            this.maxDeviationPx = 0;
            this.maxDeviationRatio = 0;
            return;
        }

        let maxDeviation = 0;

        //no need to calculate for start and end points
        for (let i = 1; i < this.log.length - 1; i += 1) {
            const point = this.log[i];
            const relX = point.x - this.start.x;
            const relY = point.y - this.start.y;

            const crossProd = relX * this.chord.dy - relY * this.chord.dx;
            const deviation = Math.abs(crossProd) / this.chord.length;

            if (deviation > maxDeviation) {
                maxDeviation = deviation;
            }
        }

        this.maxDeviationPx = maxDeviation;
        this.maxDeviationRatio = maxDeviation/this.pathLength;
    }

    /**
     * Check if the gesture is ready for classification.
     * If both thresholds are enabled (non-null), both must be met.
     * If only one is enabled, that one governs.
     * @returns {boolean}
     */
    isReadyForClassification() {
        //no thresholds set, return true
        if (this.minSamples == null && this.minDistance == null) {
            return true; 
        }

        //one or both might be set
        const enoughSamples = 
            this.minSamples == null || this.log.length >= this.minSamples;
        const enoughDistance = 
            this.minDistance == null || this.pathLength >= this.minDistance;

        return enoughSamples && enoughDistance;
    }

    /**
     * Gets the width that the logged points have covered.
     * @returns {number}
     */
    getBoundingWidth() {
        return this.#maxX - this.#minX;
    }

    /**
     * Gets the height that the logged points have covered.
     * @returns {number}
     */
    getBoundingHeight() {
        return this.#maxY - this.#minY;
    }

    /**
     * Returns total signed accumulated angle in degrees
     * @returns {number} - in degrees
     */
    getTotalTurnDegrees() {
        return this.totalTurn * 180 / Math.PI;
    }

    /**
     * Returns the angle in degrees (range 0-360) from positive x-axis of the 
     * vector between two points.
     * @param {PointSample} a - First point.
     * @param {PointSample} b - Second point.
     * @returns {number}
     */
    getAngleDegrees(a = this.start, b = this.fromLast()) {
        const dy = a.y - b.y;
        const dx = a.x - b.x;
        const degrees = Math.atan2(dy, dx) * (180 / Math.PI);

        if (degrees < 0) {
            degrees += 360;
        }

        return degrees;
    }


    /**
     * Returns the chord length, i.e., Euclidian distance between start and end.
     * @returns {number}
     */
    getChordLength() {
        return this.chord.length;
    }

    /**
     * Returns the ratio chordLength / pathLength, which has range 0-1.
     * @returns {number}
     */
    getStraightnessRatio() {
        return this.straightnessRatio;
    }

    /**
     * Returns the maximum deviation of logged points (in px) from the 
     * chord formed between start and end points.
     * @returns {number}
     */
    getMaxDeviationPx() {
        return this.maxDeviationPx;
    }

    /**
     * Returns a ratio of the maximum deviation of logged points from the 
     * chord formed between start and end points over the path length.
     * @returns {number}
     */
    getMaxDeviationRatio() {
        return this.maxDeviationRatio;
    }
}
