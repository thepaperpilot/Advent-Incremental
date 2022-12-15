import { jsx } from "features/feature";
import { createLayer } from "game/layers";
import { Application } from "@pixi/app";
import { Graphics } from "@pixi/graphics";

const id = "elves";

// what is the actual day?
const day = 20;
const factory = createLayer(id, () => {
    const name = "The Factory";
    const color = "grey";
    const app = new Application();
    const graphics = new Graphics();
    graphics.beginFill(0xff0000);
    graphics.drawRect(0, 0, 200, 100);
    app.stage.addChild(graphics);
    return {
        name,
        day,
        color,
        display: jsx(() => <>{app.view}</>)
    };
});
export default factory;
