/**
 * What Pixi's own package leaves undeclared. `pixi.js/unsafe-eval` is loaded for what it
 * does when it loads, which is to keep Pixi from `new Function` (the frame's policy
 * allows no eval): it exports nothing, and the package gives it no types.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

declare module "pixi.js/unsafe-eval";
