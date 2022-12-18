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
import { Matrix } from "@pixi/math";

const id = "factory";

// what is the actual day?
const day = 20;

// 20x20 block size
// TODO: unhardcode stuff
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

const blockSize = 50;

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
    const mapOffset = reactive({
        x: 0,
        y: 0
    });
    const isMouseHoverShown = ref(false);
    const whatIsHovered = ref<FactoryCompNames | "">("");
    const compSelected = ref<FactoryCompNames | "">("");
    const components: Ref<Record<string, unknown>> = persistent({});

    // pixi
    const app = new Application({
        backgroundAlpha: 0
    });
    const graphicContainer = new Graphics();
    const spriteContainer = new Container();
    app.stage.addChild(graphicContainer, spriteContainer);

    globalBus.on("update", () => {
    });

    // draw graphics
    function updateGraphics() {
        app.resize();
        graphicContainer.clear();
        
        spriteContainer.x = mapOffset.x * blockSize + app.view.width / 2;
        spriteContainer.y = mapOffset.y * blockSize + app.view.height / 2;
        
        if (isMouseHoverShown.value) {
            let { tx, ty } = spriteContainer.localTransform;
            graphicContainer.beginFill(0x808080);
            graphicContainer.drawRect(
                roundDownTo(mouseCoords.x - tx, blockSize) + tx,
                roundDownTo(mouseCoords.y - ty, blockSize) + ty,
                blockSize,
                blockSize
            );
        }
    }
    watchEffect(updateGraphics);

    let pointerDown = ref(false), pointerDrag = ref(false);

    function onFactoryPointerMove(e: PointerEvent) {

        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;

        if (pointerDown.value && (pointerDrag.value || Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) {
            pointerDrag.value = true;
            mapOffset.x += e.movementX / blockSize;
            mapOffset.y += e.movementY / blockSize;
        }
    }
    async function onFactoryPointerDown(e: PointerEvent) {
        window.addEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = true;
    }
    async function onFactoryPointerUp(e: PointerEvent) {
        if (!pointerDrag.value) {
            if (compSelected.value !== "") {
                let { tx, ty } = spriteContainer.localTransform;
                let { x, y } = getRelativeCoords(e);
                x = roundDownTo(x - tx, blockSize) / blockSize;
                y = roundDownTo(y - ty, blockSize) / blockSize;

                const basicData = structuredClone(
                    FACTORY_COMPONENTS[compSelected.value]
                ) as FactoryComponent;
                basicData.type = compSelected.value;
                const sheet = await Assets.load(basicData.imageSrc);
                basicData.sprite = new Sprite(sheet);

                basicData.sprite.x = x * blockSize;
                basicData.sprite.y = y * blockSize;
                basicData.sprite.width = blockSize;
                basicData.sprite.height = blockSize;
                spriteContainer.addChild(basicData.sprite);
            }
        }

        window.removeEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = pointerDrag.value = false;
    }
    function onFactoryMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onFactoryMouseLeave() {
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
        style: { overflow: "hidden" },
        display: jsx(() => (
            <div class="layer-container">
                <button class="goBack" onClick={goBack}>
                    ❌
                </button>
                <Factory
                    application={app}
                    onPointermove={onFactoryPointerMove}
                    onPointerdown={onFactoryPointerDown}
                    onPointerenter={onFactoryMouseEnter}
                    onPointerleave={onFactoryMouseLeave}
                />
                <div cellspacing="0" cellpadding="0" border="0" class="container">
                    <div style="line-height: 2.5em; min-height: 2.5em">
                        {whatIsHovered.value === ""
                            ? undefined
                            : FACTORY_COMPONENTS[whatIsHovered.value].description}
                    </div>
                    <div class="comps">
                        <div>
                            {Object.entries(FACTORY_COMPONENTS).map(value => {
                                const key = value[0] as FactoryCompNames;
                                const item = value[1];
                                return (
                                    <img
                                        src={item.imageSrc}
                                        class={{ selected: compSelected.value === key }}
                                        onMouseenter={() => onComponentHover(key)}
                                        onMouseleave={() => onComponentHover("")}
                                        onClick={() => onCompClick(key)}
                                    ></img>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )),
        components
    };
});
export default factory;
