import { WGSToLambert93 } from "common/geographics";
import Vector2 from "./Vector";

export default class Point {
  constructor(
    protected _x: number,
    protected _y: number,
  ) {}

  public get x() {
    return this._x;
  }

  public get y() {
    return this._y;
  }

  transform(v: Vector2) {
    this._x += v.x;
    this._y += v.y;
    return this;
  }

  static transform(p: Point, v: Vector2): Point {
    return new Point(p.x + v.x, p.y + v.y);
  }

  distance(p: Point) {
    return Math.sqrt((p.x - this.x) ** 2 + (p.y - this.y) ** 2);
  }

  static distance(p1: Point, p2: Point): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  fromWGSToLambert93() {
    const [x, y] = WGSToLambert93(this._x, this._y);
    this._x = x;
    this._y = y;
    return this;
  }
}
