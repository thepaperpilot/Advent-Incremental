import { jsx } from "features/feature";
import { createLayer } from "game/layers";
import { Application } from "@pixi/app";
import { Sprite } from "@pixi/sprite";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";
import Factory from "./Factory.vue";
import conveyor from "./factory-components/conveyor.png";
import cursor from "./factory-components/cursor.jpg";
import square from "./factory-components/square.jpg";
import { computed, ComputedRef, reactive, Ref, ref, watchEffect } from "vue";
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

enum FactoryDirections {
    Any,
    None
}
type FactoryDirection = FactoryDirections | Direction;

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

const factorySize = {
    width: 50,
    height: 50
};
const blockSize = 50;

const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    const FACTORY_COMPONENTS = {
        cursor: {
            imageSrc: cursor,
            name: "Cursor",
            description: "Use this to move.",
            tick: 0,
            directionIn: FactoryDirections.None,
            directionOut: FactoryDirections.None,
            consumption: {},
            consumptionStock: {},
            production: {},
            productionStock: {}
        },
        conveyor: {
            directionIn: FactoryDirections.Any,
            directionOut: FactoryDirections.Any,
            imageSrc: conveyor,
            name: "Conveyor",
            description: "Moves 1 item per tick.",
            tick: 1,
            consumption: {},
            consumptionStock: {},
            production: {},
            productionStock: {}
        },
        square: {
            directionIn: FactoryDirections.Any,
            directionOut: FactoryDirections.None,
            imageSrc: square,
            name: "???",
            description: "Produces 1 square every 1 tick.",
            tick: 1,
            production: {
                square: 1
            },
            productionStock: {
                square: Infinity
            },
            consumption: {},
            consumptionStock: {}
        }
    } as Record<"cursor" | "conveyor" | "square", FactoryComponentDeclaration>;

    type FactoryCompNames = keyof typeof FACTORY_COMPONENTS;
    type BuildableCompName = Exclude<FactoryCompNames, "cursor">;

    interface FactoryComponent {
        type: BuildableCompName;
        ticksDone: number;
        // current consumption stock
        consumptionStock: Record<string, number>;

        // current production stock
        productionStock: Record<string, number>;
    }
    interface FactoryComponentDeclaration {
        tick: number;
        directionIn: FactoryDirection;
        directionOut: FactoryDirection;
        imageSrc: string;
        name: string;
        description: string;

        // amount it consumes
        consumption: Record<string, number>;
        // maximum stock of consumption
        consumptionStock: Record<string, number>;
        // amount it produces
        production: Record<string, number>;
        // maximum stock of production
        productionStock: Record<string, number>;

        // on produce, do something
        onProduce?: (times: number) => void;
        // can it produce? (in addtion to the stock check)
        canProduce?: ComputedRef<boolean>;
    }

    interface FactoryInternal {
        sprite: Sprite;
        canProduce: ComputedRef<boolean>;
    }

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
    const compSelected = ref<FactoryCompNames>("cursor");
    const components: Ref<(FactoryComponent | null)[][]> = persistent(
        Array(factorySize.width)
            .fill(undefined)
            .map(() => Array(factorySize.height).fill(null))
    );
    const compInternalData: (FactoryInternal | null)[][] = Array(factorySize.width)
        .fill(undefined)
        .map(() => Array(factorySize.height).fill(null));

    // pixi
    const app = new Application({
        backgroundAlpha: 0
    });
    const graphicContainer = new Graphics();
    const spriteContainer = new Container();
    const movingBlocks = new Container();

    graphicContainer.zIndex = 1;
    app.stage.addChild(graphicContainer, spriteContainer, movingBlocks);
    app.stage.sortableChildren = true;

    globalBus.on("update", diff => {
        // will change soon:tm:
        const tick = diff;
        for (const y of components.value.keys()) {
            for (const x of components.value[y].keys()) {
                const data = components.value[y][x];
                const compData = compInternalData[y][x];
                //console.log(compData, data)
                if (data === null || compData === null) continue;
                const factoryData = FACTORY_COMPONENTS[data.type];
                if (data.ticksDone >= factoryData.tick) {
                    if (!compData.canProduce.value) continue;
                    const cyclesDone = Math.floor(data.ticksDone / factoryData.tick);
                    console.log("produce", data.ticksDone, factoryData.tick);
                    factoryData.onProduce?.(cyclesDone);
                    for (const [key, val] of Object.entries(factoryData.consumption)) {
                        data.consumptionStock[key] -= val;
                    }
                    for (const [key, val] of Object.entries(factoryData.production)) {
                        data.productionStock[key] -= val;
                    }
                    data.ticksDone -= cyclesDone * factoryData.tick;
                } else {
                    data.ticksDone += tick;
                }
            }
        }
    });

    /*async function changeFactoryComponent(y: number, x: number) {
        const comp = componentData.value[y][x];
        if (comp === null) return;
        const data = FACTORY_COMPONENTS[comp.type];
        const sprite = await positionSprite(
            FACTORY_COMPONENTS[comp.type].imageSrc,
            y * blockHeight.value,
            x * blockWidth.value,
            blockWidth.value,
            blockHeight.value
        );
        components[y][x] = {
            sprite,
            canProduce: computed(() => {
                if (!(data.canProduce?.value ?? true)) return false;
                for (const [key, res] of Object.entries(comp.productionStock)) {
                    // if the current stock + production is more than you can handle
                    if (res + data.production[key] > data.productionStock[key]) return false;
                }
                for (const [key, res] of Object.entries(comp.consumptionStock)) {
                    // make sure you have enough to produce
                    if (res < data.consumptionStock[key]) return false;
                }
                return true;
            })
        };
        spriteContainer.addChild(sprite);
    }*/

    // draw graphics
    function updateGraphics() {
        app.resize();
        graphicContainer.clear();

        spriteContainer.x = mapOffset.x * blockSize + app.view.width / 2;
        spriteContainer.y = mapOffset.y * blockSize + app.view.height / 2;

        if (isMouseHoverShown.value && compSelected.value === "cursor") {
            const { tx, ty } = spriteContainer.localTransform;
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

    const pointerDown = ref(false),
        pointerDrag = ref(false);

    function onFactoryPointerMove(e: PointerEvent) {
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;

        if (
            pointerDown.value &&
            compSelected.value === "cursor" &&
            (pointerDrag.value || Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)
        ) {
            pointerDrag.value = true;
            mapOffset.x += e.movementX / blockSize;
            mapOffset.y += e.movementY / blockSize;
        }
    }
    async function onFactoryPointerDown() {
        window.addEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = true;
    }
    async function onFactoryPointerUp(e: PointerEvent) {
        // make sure they're not dragging and that
        // they aren't trying to put down a cursor
        if (!pointerDrag.value && compSelected.value !== "cursor") {
            const { tx, ty } = spriteContainer.localTransform;
            let { x, y } = getRelativeCoords(e);
            x = roundDownTo(x - tx, blockSize) / blockSize;
            y = roundDownTo(y - ty, blockSize) / blockSize;
            const factoryBaseData = FACTORY_COMPONENTS[compSelected.value];
            const sheet = await Assets.load(factoryBaseData.imageSrc);
            const sprite = new Sprite(sheet);

            console.log(x, y);

            sprite.x = x * blockSize;
            sprite.y = y * blockSize;
            sprite.width = blockSize;
            sprite.height = blockSize;
            components.value[y][x] = {
                type: compSelected.value,
                ticksDone: 0,
                consumptionStock: structuredClone(factoryBaseData.consumptionStock),
                productionStock: structuredClone(factoryBaseData.productionStock)
            };
            compInternalData[y][x] = {
                canProduce: computed(() => {
                    if (!(factoryBaseData.canProduce?.value ?? true)) return false;
                    // this should NEVER be null
                    const compData = components.value[y][x] as FactoryComponent;
                    for (const [key, res] of Object.entries(compData.productionStock)) {
                        // if the current stock + production is more than you can handle
                        if (
                            res + factoryBaseData.production[key] >
                            factoryBaseData.productionStock[key]
                        )
                            return false;
                    }
                    for (const [key, res] of Object.entries(compData.consumptionStock)) {
                        // make sure you have enough to produce
                        if (res < factoryBaseData.consumptionStock[key]) return false;
                    }
                    return true;
                }),
                sprite
            };
            spriteContainer.addChild(sprite);
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
        if (compSelected.value !== "cursor") return;
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
        components,
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
        ))
    };
});
export default factory;
