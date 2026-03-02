declare module 'robust-point-in-polygon' {
  /**
   * Checks if a point is inside a polygon
   * @param polygon - Array of [x, y] coordinates defining the polygon
   * @param point - [x, y] coordinates of the point to test
   * @returns -1 if point is inside, 0 if on boundary, 1 if outside
   */
  function robustPointInPolygon(
    polygon: number[][],
    point: [number, number]
  ): -1 | 0 | 1

  export = robustPointInPolygon
}
