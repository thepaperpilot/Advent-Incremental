import { jsx } from "features/feature";
import { createLayer } from "game/layers";
import { Application } from "@pixi/app";
import { Sprite } from "@pixi/sprite";
import { Graphics } from "@pixi/graphics";
import Factory from "./Factory.vue";
import Modal from "components/Modal.vue";
import conveyor from "./factory-components/conveyor.png";
import { reactive, Ref, ref, watchEffect } from "vue";
import { Direction } from "util/common";
import { persistent } from "game/persistence";
import player from "game/player";

const id = "factory";

// what is the actual day?

enum FactoryTypes {
    conveyor,
    conveyor1
}

interface FactoryComponent {
    type: FactoryTypes | undefined;
    directionIn: Direction | undefined;
    directionOut: Direction | undefined;
}
const day = 20;
const size = {
    width: 1000,
    height: 400
};

// 20x20 block size
// TODO: unhardcode stuff
const blockAmts = {
    w: 50,
    h: 20
};

const blockWidth = Math.floor(size.width / blockAmts.w);
const blockHeight = Math.floor(size.height / blockAmts.h);

function roundDownTo(num: number, multiple: number) {
    return Math.floor(num / multiple) * multiple;
}
function getRelativeCoords(e: MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}
const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    // mouse positions
    const mouseCoords = reactive({
        x: 0,
        y: 0
    });
    const isMouseHoverShown = ref(false);
    const isFactoryShown = ref(false);
    // create a Array filled with th
    const components: Ref<FactoryComponent[][]> = persistent(
        Array(blockHeight)
            .fill(undefined)
            .map(() =>
                Array(blockWidth)
                    .fill(undefined)
                    .map(() => ({
                        type: undefined,
                        directionIn: undefined,
                        directionOut: undefined
                    }))
            )
    );

    // pixi
    const app = new Application(size);
    const graphicContainer = new Graphics();
    app.stage.addChild(graphicContainer);

    // draw graphics
    function updateGraphics() {
        // factory not shown, no point in rerendering stuff
        if (isFactoryShown.value) {
            graphicContainer.clear();
            if (isMouseHoverShown.value) {
                graphicContainer.beginFill(0x808080);
                graphicContainer.drawRect(
                    roundDownTo(mouseCoords.x, blockWidth),
                    roundDownTo(mouseCoords.y, blockHeight),
                    blockWidth,
                    blockHeight
                );
            }
        }
    }
    watchEffect(updateGraphics);

    function onMouseMove(e: MouseEvent) {
        // some code to get the x and y coords relative to element
        // https://stackoverflow.com/questions/3234256/find-mouse-position-relative-to-element
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;
    }
    function onClick(e: MouseEvent) {
        // placeholder
    }
    function onMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onMouseLeave() {
        isMouseHoverShown.value = false;
    }
    function goBack() {
        player.tabs.splice(0, Infinity, "main")
    }
    return {
        name,
        day,
        color,
        minWidth: 700,
        minimizable: false,
        display: jsx(() => (
            <div class="layer-container">
                <button class="goBack" onClick={goBack}>❌</button>
                <Factory
                    application={app}
                    onMouseMove={onMouseMove}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={onClick}
                />
            </div>
        )),
        components
    };
});
export default factory;
