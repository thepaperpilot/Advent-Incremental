import { jsx } from "features/feature";
import { createLayer } from "game/layers";
import { Application } from "@pixi/app";
import { Sprite } from "@pixi/sprite";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";
import Factory from "./Factory.vue";
import Modal from "components/Modal.vue";
import conveyor from "./factory-components/conveyor.png";
import cursor from "./factory-components/cursor.jpg";
import { computed, reactive, Ref, ref, watchEffect } from "vue";
import { Direction } from "util/common";
import { persistent } from "game/persistence";
import player from "game/player";
import "./styles/factory.css";
import { globalBus } from "game/events";
import { Container } from "@pixi/display";

const id = "factory";

// what is the actual day?
const day = 20;

// 20x20 block size
// TODO: unhardcode stuff
const size = {
    width: 1000,
    height: 340
};
export const blockAmts = {
    w: 50,
    h: 17
};

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

interface FactoryComponent {
    directionIn: Direction | undefined;
    directionOut: Direction | undefined;
    imageSrc: string;
    name: string;
    description: string;
    type: string;
    sprite: Sprite;
}
const FACTORY_COMPONENTS = {
    cursor: {
        directionIn: undefined,
        directionOut: undefined,
        imageSrc: cursor,
        name: "Cursor",
        description: "Use this to move."
    },
    conveyor: {
        directionIn: Direction,
        directionOut: Direction,
        imageSrc: conveyor,
        name: "Conveyor",
        description: "Moves 1 item per tick."
    },
    someOtherComponent: {
        directionIn: Direction.Down,
        directionOut: undefined,
        imageSrc: conveyor,
        description: "Accepts anything and produces nothing."
    }
};

type FactoryCompNames = keyof typeof FACTORY_COMPONENTS;
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
    const whatIsHovered = ref<FactoryCompNames | "">("");
    const compSelected = ref<FactoryCompNames | "">("");
    const components: Ref<unknown[][]> = persistent(
        Array(blockAmts.h)
            .fill(undefined)
            .map(() => Array(blockAmts.w).fill(undefined))
    );

    // pixi
    const app = new Application(size);
    const graphicContainer = new Graphics();
    const spriteContainer = new Container();
    let blockWidth = 0;
    let blockHeight = 0;
    app.stage.addChild(graphicContainer, spriteContainer);

    globalBus.on("update", () => {
        blockWidth = app.screen.width / blockAmts.w;
        blockHeight = app.screen.height / blockAmts.h;
    });

    // draw graphics
    function updateGraphics() {
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
    watchEffect(updateGraphics);

    function onMouseMove(e: MouseEvent) {
        // some code to get the x and y coords relative to element
        // https://stackoverflow.com/questions/3234256/find-mouse-position-relative-to-element
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;
    }
    async function onClick(e: MouseEvent) {
        if (compSelected.value === "") {
            console.warn("You haven't hovered over anything, trickster!");
            return;
        }
        let { x, y } = getRelativeCoords(e);
        x = roundDownTo(x, blockWidth) / blockWidth;
        y = roundDownTo(y, blockHeight) / blockHeight;
        const basicData = structuredClone(
            FACTORY_COMPONENTS[compSelected.value]
        ) as FactoryComponent;
        basicData.type = compSelected.value;
        const sheet = await Assets.load(basicData.imageSrc);
        basicData.sprite = new Sprite(sheet);
        basicData.sprite.x = x;
        basicData.sprite.y = y;
        basicData.sprite.width = blockWidth;
        basicData.sprite.height = blockHeight;
        spriteContainer.addChild(basicData.sprite);
    }
    function onMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onMouseLeave() {
        isMouseHoverShown.value = false;
    }
    function goBack() {
        player.tabs.splice(0, Infinity, "main");
    }
    function onComponentHover(name: FactoryCompNames | "") {
        whatIsHovered.value = name;
    }
    function onCompClick(name: FactoryCompNames) {
        compSelected.value = name;
    }
    return {
        name,
        day,
        color,
        minWidth: 700,
        minimizable: false,
        display: jsx(() => (
            <div class="layer-container">
                <button class="goBack" onClick={goBack}>
                    ❌
                </button>
                <table cellspacing="0" cellpadding="0" border="0" class="container">
                    <tr>
                        <td class="info" colspan="2">
                            <div style="min-height: 3em">
                                {whatIsHovered.value === ""
                                    ? undefined
                                    : FACTORY_COMPONENTS[whatIsHovered.value].description}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align: top" class="comps">
                            <h3>Components</h3>
                            <div>
                                {Object.entries(FACTORY_COMPONENTS).map(value => {
                                    const key = value[0] as FactoryCompNames;
                                    const item = value[1];
                                    return (
                                        <img
                                            src={item.imageSrc}
                                            style={{
                                                width: "20%",
                                                "aspect-ratio": "1",
                                                border:
                                                    compSelected.value === key
                                                        ? "1px solid white"
                                                        : ""
                                            }}
                                            onMouseenter={() => onComponentHover(key)}
                                            onMouseleave={() => onComponentHover("")}
                                            onClick={() => onCompClick(key)}
                                        ></img>
                                    );
                                })}
                            </div>
                        </td>
                        <td>
                            <Factory
                                application={app}
                                onMousemove={onMouseMove}
                                onClick={onClick}
                                onMouseenter={onMouseEnter}
                                onMouseleave={onMouseLeave}
                            />
                        </td>
                    </tr>
                </table>
            </div>
        )),
        components
    };
});
export default factory;
