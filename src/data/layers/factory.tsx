import { Application } from "@pixi/app";
import { Assets } from "@pixi/assets";
import { Container } from "@pixi/display";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";
import HotkeyVue from "components/Hotkey.vue";
import Row from "components/layout/Row.vue";
import Spacer from "components/layout/Spacer.vue";
import Modal from "components/Modal.vue";
import { createCollapsibleModifierSections } from "data/common";
import { main } from "data/projEntry";
import { createBar, GenericBar } from "features/bars/bar";
import { createBuyable, GenericBuyable } from "features/buyable";
import { jsx, showIf } from "features/feature";
import { createHotkey, GenericHotkey } from "features/hotkey";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, Resource } from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { createTabFamily } from "features/tabs/tabFamily";
import Tooltip from "features/tooltips/Tooltip.vue";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import { createLayer } from "game/layers";
import {
    createAdditiveModifier,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "game/modifiers";
import { noPersist, Persistent, persistent, State } from "game/persistence";
import Decimal, { DecimalSource, format, formatList, formatWhole } from "util/bignum";
import { Direction, WithRequired } from "util/common";
import { ProcessedComputable } from "util/computed";
import { render, renderGrid, renderRow, VueFeature } from "util/vue";
import { computed, ComputedRef, reactive, ref, shallowRef, unref, watchEffect } from "vue";
import _cloth from "../symbols/cloth.png";
import _dye from "../symbols/dyes.png";
import _metal from "../symbols/metal.png";
import _plastic from "../symbols/plastic.png";
import boxes from "./boxes";
import coal from "./coal";
import dyes from "./dyes";
import _box from "../symbols/cardboardBox.png";
import _bear from "./factory-components/bear.svg";
import _bearMaker from "./factory-components/bearmaker.svg";
import _block from "./factory-components/block.svg";
import _boxMaker from "./factory-components/boxmaker.svg";
import _blockMaker from "./factory-components/blockmaker.svg";
import _bucket from "./factory-components/bucket.svg";
import _bucketMaker from "./factory-components/bucketmaker.svg";
import _bucketShovel from "./factory-components/bucketshovel.svg";
import _bucketShovelMaker from "./factory-components/bucketshovelmaker.svg";
import _button from "./factory-components/button.svg";
import _buttonMaker from "./factory-components/buttonmaker.svg";
import _circuitBoard from "./factory-components/circuit.svg";
import _circuitBoardMaker from "./factory-components/circuitmaker.svg";
import _clothes from "./factory-components/clothes.svg";
import _clothesMaker from "./factory-components/clothesmaker.svg";
import _console from "./factory-components/console.svg";
import _consoleMaker from "./factory-components/consolemaker.svg";
import _conveyor from "./factory-components/conveyor.png";
import _cursor from "./factory-components/cursor.svg";
import _delete from "./factory-components/delete.svg";
import _wood from "./factory-components/log.svg";
import _plank from "./factory-components/plank.svg";
import _rotateLeft from "./factory-components/rotateLeft.svg";
import _rotateRight from "./factory-components/rotateRight.svg";
import _plankMaker from "./factory-components/sawmill.svg";
import _shed from "./factory-components/shed.svg";
import _shovel from "./factory-components/shovel.svg";
import _shovelMaker from "./factory-components/shovelmaker.svg";
import _stuffing from "./factory-components/stuffing.svg";
import _stuffingMaker from "./factory-components/stuffingmaker.svg";
import _thread from "./factory-components/thread.svg";
import _threadMaker from "./factory-components/threadmaker.svg";
import _truck from "./factory-components/truck.svg";
import _truckMaker from "./factory-components/truckmaker.svg";
import _wheel from "./factory-components/wheel.svg";
import _wheelMaker from "./factory-components/wheelmaker.svg";
import _present from "./factory-components/present.svg";
import _presentMaker from "./factory-components/presentmaker.svg";
import Factory from "./Factory.vue";
import metal from "./metal";
import oil from "./oil";
import paper from "./paper";
import plastic from "./plastic";
import "./styles/factory.css";
import Toy from "./Toy.vue";
import toys from "./toys";
import trees from "./trees";
import workshop from "./workshop";

const id = "factory";

const day = 18;
const advancedDay = 19;
const presentsDay = 20;

const toyGoal = 750;
const advancedToyGoal = 1500;
const presentsGoal = 8e9;

// 20x20 block size
// TODO: unhardcode stuff

function roundDownTo(num: number, multiple: number) {
    return Math.floor((num + multiple / 2) / multiple) * multiple;
}
function rotateDir(dir: Direction, relative = Direction.Right) {
    const directions = [Direction.Up, Direction.Right, Direction.Down, Direction.Left];
    let index = directions.indexOf(dir);
    index += directions.indexOf(relative);
    index = index % directions.length;
    return directions[index];
}
function directionToNum(dir: Direction) {
    switch (dir) {
        case Direction.Left:
        case Direction.Up:
            return -1;
        case Direction.Right:
        case Direction.Down:
            return 1;
    }
}
function getDirection(dir: Direction) {
    switch (dir) {
        case Direction.Left:
        case Direction.Right:
            return "h";
        case Direction.Up:
        case Direction.Down:
            return "v";
    }
}
const blockSize = 50;

const factory = createLayer(id, () => {
    // layer display
    const name = "The Factory";
    const color = "grey";

    const bears = createResource<DecimalSource>(0, "teddy bears");
    const bucketAndShovels = createResource<DecimalSource>(0, "shovel and pails");
    const consoles = createResource<DecimalSource>(0, "consoles");
    const presents = createResource<DecimalSource>(0, "presents");

    const allToys = {
        clothes: toys.clothes,
        woodenBlocks: toys.woodenBlocks,
        trucks: toys.trucks,
        bears,
        bucketAndShovels,
        consoles
    };

    function getRelativeCoords(e: MouseEvent) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const offset = computedFactorySize.value % 2 === 0 ? -blockSize / 2 : 0;
        return {
            x: e.clientX - rect.left + offset,
            y: e.clientY - rect.top + offset
        };
    }

    const energy = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: () => Decimal.add(1, coal.coal.value).log10(),
            description: "Coal Energy Production"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.add(1, coal.coal.value).log10().div(100),
            description: "1400% workshop",
            enabled: workshop.milestones.extraExpansionMilestone7.earned
        })),
        createAdditiveModifier(() => ({
            addend: () => Decimal.times(oilFuel.amount.value, 10),
            description: "Oil Fuel",
            enabled: () => Decimal.gt(oilFuel.amount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.4,
            description: "1500 toys",
            enabled: toys.milestones.milestone6.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.4,
            description: "6000 toys",
            enabled: toys.milestones.milestone6.earned
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.log10(trees.logs.value).div(100).add(1),
            description: "Burn some logs",
            enabled: betterLighting.bought
        }))
    ]) as WithRequired<Modifier, "revert" | "description">;
    const computedEnergy = computed(() => energy.apply(0));
    const energyConsumption = computed(() =>
        Object.values(components.value)
            .map(c => FACTORY_COMPONENTS[c.type]?.energyCost ?? 0)
            .reduce((a, b) => a + b, 0)
    );
    const energyEfficiency = computed(() =>
        Decimal.div(energyConsumption.value, computedEnergy.value).recip().pow(2).min(1)
    );
    const tickRate = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: elvesEffect,
            description: "Trained Elves"
        })),
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.div(carryToys.amount.value, 10).add(1),
            description: "Carry toys in boxes",
            enabled: () => Decimal.gt(carryToys.amount.value, 0)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: energyEfficiency,
            description: "Energy Consumption",
            enabled: () => Decimal.gt(energyConsumption.value, computedEnergy.value)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.add(paper.paper.value, 1).log10().div(100).add(1),
            description: "News Ticker",
            enabled: () => upgrades[0][1].bought.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.lt(energyEfficiency.value, 1)
                ? 1
                : Decimal.sub(
                      2,
                      Decimal.div(energyConsumption.value, Decimal.max(computedEnergy.value, 1))
                  ),
            description: "Brighter work rooms",
            enabled: () => upgrades[2][0].bought.value
        })),
        createMultiplicativeModifier(() => ({
            multiplier: 1.5,
            description: "Carry ticks in boxes",
            enabled: () => upgrades[2][3].bought.value
        }))
    ]);
    const computedTickRate = computed(() => tickRate.apply(1));
    const computedActualTickRate = computed(() => Decimal.min(computedTickRate.value, 5));
    const computedToyMultiplier = computed(() => Decimal.div(computedTickRate.value, 5).max(1));
    const factorySize = createSequentialModifier(() => [
        createAdditiveModifier(() => ({
            addend: expandFactory.amount,
            description: "Expand Factory",
            enabled: () => Decimal.gt(expandFactory.amount.value, 0)
        })),
        createAdditiveModifier(() => ({
            addend: 5,
            description: "Factory eXPerience",
            enabled: betterFactory.bought
        }))
    ]);
    const computedFactorySize = computed(() => new Decimal(factorySize.apply(7)).toNumber());
    const presentMultipliers = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: computedToyMultiplier,
            description: "Tickspeed overflow",
            enabled: () => computedToyMultiplier.value.gt(1)
        })),
        createMultiplicativeModifier(() => ({
            multiplier: Decimal.div(boxes.buyables3.presentBuyable.amount.value, 10).add(1).pow(2),
            description: "Carry boxes in... presents?",
            enabled: carryPresents.bought
        }))
    ]);
    const computedPresentMultipliers = computed(() => presentMultipliers.apply(1));

    const energyBar = createBar(() => ({
        width: 680,
        height: 50,
        direction: Direction.Right,
        classes: { "energy-bar": true },
        style: { borderRadius: "var(--border-radius) var(--border-radius) 0 0" },
        borderStyle: { borderRadius: "var(--border-radius) var(--border-radius) 0 0" },
        fillStyle: () => ({
            backgroundColor: Decimal.gt(energyConsumption.value, computedEnergy.value)
                ? "red"
                : "yellow"
        }),
        progress: () =>
            Decimal.gt(energyConsumption.value, computedEnergy.value)
                ? Decimal.sub(1, Decimal.div(computedEnergy.value, energyConsumption.value))
                : Decimal.sub(1, Decimal.div(energyConsumption.value, computedEnergy.value)),
        display: jsx(() => (
            <>
                <div>
                    {formatWhole(energyConsumption.value)} / {formatWhole(computedEnergy.value)}{" "}
                    energy used
                    {Decimal.gt(energyConsumption.value, computedEnergy.value) ? (
                        <>{" (" + format(Decimal.mul(energyEfficiency.value, 100))}% efficiency)</>
                    ) : (
                        ""
                    )}
                </div>
                <div>
                    <Tooltip display="Clear Tracks" direction={Direction.Down}>
                        <button class="control-btn material-icons" onClick={setTracks}>
                            clear
                        </button>
                    </Tooltip>
                    <Tooltip display="Clear Factory" direction={Direction.Down}>
                        <button class="control-btn material-icons" onClick={clearFactory}>
                            delete
                        </button>
                    </Tooltip>
                    <Tooltip display="Go to Center" direction={Direction.Down} xoffset="-26px">
                        <button class="control-btn material-icons" onClick={moveToCenter}>
                            center_focus_weak
                        </button>
                    </Tooltip>
                    <Tooltip
                        display={(paused.value ? "Unpause" : "Pause") + " the Factory"}
                        direction={Direction.Down}
                        xoffset="-63px"
                    >
                        <button class="control-btn material-icons" onClick={togglePaused}>
                            {paused.value ? "play_arrow" : "pause"}
                        </button>
                    </Tooltip>
                </div>
            </>
        ))
    }));

    // ---------------------------------------------- Components

    function generateComponentDescription(declaration: FactoryComponentDeclaration) {
        let str = declaration.inputs === undefined ? "Produces " : "Turns ";
        if (declaration.inputs !== undefined) {
            str +=
                formatList(
                    Object.entries(declaration.inputs).map(
                        x =>
                            formatWhole(unref(x[1].amount)) +
                            " " +
                            RESOURCES[x[0] as ResourceNames].name
                    )
                ) + " into ";
        }
        if (declaration.outputs !== undefined) {
            str +=
                formatList(
                    Object.entries(declaration.outputs).map(
                        x =>
                            formatWhole(unref(x[1].amount)) +
                            " " +
                            RESOURCES[x[0] as ResourceNames].name
                    )
                ) + " per tick.";
        }
        return str;
    }

    // this keeps track of which toy the present factory has consumed
    // it cycles around, so each toy is used evenly
    let toysIndex = 0;

    const FACTORY_COMPONENTS = {
        cursor: {
            imageSrc: _cursor,
            key: "Escape",
            name: "Cursor",
            type: "command",
            description: "Drag while equipping this to move around.",
            tick: 0
        } as FactoryComponentDeclaration,
        delete: {
            imageSrc: _delete,
            key: "Backspace",
            name: "Delete",
            type: "command",
            description: "Remove components from the board.",
            tick: 0
        } as FactoryComponentDeclaration,
        rotateLeft: {
            imageSrc: _rotateLeft,
            key: "t",
            name: "Rotate Left",
            type: "command",
            description: "Use this to rotate components counter-clockwise.",
            tick: 0
        } as FactoryComponentDeclaration,
        rotateRight: {
            imageSrc: _rotateRight,
            key: "shift+T",
            name: "Rotate Right",
            type: "command",
            description: "Use this to rotate components clockwise.",
            tick: 0
        } as FactoryComponentDeclaration,
        conveyor: {
            imageSrc: _conveyor,
            key: "0",
            name: "Conveyor",
            type: "conveyor",
            description: "Moves items at 1 block per tick.",
            energyCost: 1,
            tick: 1,
            ports: {
                [Direction.Left]: {
                    type: "input"
                },
                [Direction.Right]: {
                    type: "output"
                }
            }
        } as FactoryComponentDeclaration,
        wood: {
            imageSrc: _shed,
            extraImage: _wood,
            key: "1",
            name: "Wood Machine",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.wood)),
            energyCost: 10,
            tick: 1,
            outputs: {
                wood: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        cloth: {
            imageSrc: _shed,
            extraImage: _cloth,
            key: "2",
            name: "Cloth Machine",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.cloth)),
            energyCost: 10,
            tick: 1,
            outputs: {
                cloth: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        dye: {
            imageSrc: _shed,
            extraImage: _dye,
            key: "3",
            name: "Dye Machine",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.dye)),
            energyCost: 10,
            tick: 1,
            outputs: {
                dye: {
                    amount: computed(() => (upgrades[1][1].bought.value ? 4 : 1))
                }
            }
        } as FactoryComponentDeclaration,
        metal: {
            imageSrc: _shed,
            extraImage: _metal,
            key: "4",
            name: "Metal Machine",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.metal)),
            energyCost: 10,
            tick: 1,
            outputs: {
                metal: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        plastic: {
            imageSrc: _shed,
            extraImage: _plastic,
            key: "5",
            name: "Plastic Machine",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.plastic)),
            energyCost: 10,
            tick: 1,
            outputs: {
                plastic: {
                    amount: computed(() => (upgrades[1][2].bought.value ? 4 : 1))
                }
            }
        } as FactoryComponentDeclaration,
        plank: {
            imageSrc: _plankMaker,
            key: "shift+1",
            name: "Sawmill",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.plank)),
            energyCost: 2,
            tick: 1,
            inputs: {
                wood: {
                    amount: computed(() => (upgrades[0][0].bought.value ? 2 : 1))
                }
            },
            outputs: {
                plank: {
                    amount: computed(() => (upgrades[0][0].bought.value ? 2 : 1))
                }
            },
            visible: main.days[presentsDay - 1].opened
        } as FactoryComponentDeclaration,
        thread: {
            imageSrc: _threadMaker,
            key: "shift+2",
            name: "Thread Spinner",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.thread)),
            energyCost: 2,
            tick: 1,
            inputs: {
                cloth: {
                    amount: 1
                }
            },
            outputs: {
                thread: {
                    amount: 1
                }
            }
        } as FactoryComponentDeclaration,
        wheel: {
            imageSrc: _wheelMaker,
            key: "shift+3",
            name: "Wheel Crafter",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.wheel)),
            energyCost: 2,
            tick: 1,
            inputs: {
                plastic: {
                    amount: 1
                }
            },
            outputs: {
                wheel: {
                    amount: computed(() => (toys.milestones.milestone5.earned.value ? 2 : 1))
                }
            }
        } as FactoryComponentDeclaration,
        button: {
            imageSrc: _buttonMaker,
            key: "shift+4",
            name: "Button Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.button)),
            energyCost: 2,
            tick: 1,
            inputs: {
                plastic: {
                    amount: 1
                }
            },
            outputs: {
                buttons: {
                    amount: 2
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        stuffing: {
            imageSrc: _stuffingMaker,
            key: "shift+5",
            name: "Cloth Shredder",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.stuffing)),
            energyCost: 2,
            tick: 1,
            inputs: {
                cloth: {
                    amount: 1
                }
            },
            outputs: {
                stuffing: {
                    amount: 1
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        shovel: {
            imageSrc: _shovelMaker,
            key: "shift+6",
            name: "Shovel Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.shovel)),
            energyCost: 2,
            tick: 1,
            inputs: {
                plastic: {
                    amount: 2
                }
            },
            outputs: {
                shovel: {
                    amount: 1
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        bucket: {
            imageSrc: _bucketMaker,
            key: "shift+7",
            name: "Bucket Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.bucket)),
            energyCost: 2,
            tick: 1,
            inputs: {
                plastic: {
                    amount: 3
                }
            },
            outputs: {
                bucket: {
                    amount: 1
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        circuitBoard: {
            imageSrc: _circuitBoardMaker,
            key: "shift+8",
            name: "Circuit Board Manufacturer",
            type: "processor",
            description: computed(() =>
                generateComponentDescription(FACTORY_COMPONENTS.circuitBoard)
            ),
            energyCost: 2,
            tick: 1,
            inputs: {
                metal: {
                    amount: 1
                },
                plastic: {
                    amount: 1
                }
            },
            outputs: {
                circuitBoard: {
                    amount: 1
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        boxMaker: {
            imageSrc: _boxMaker,
            key: "shift+9",
            name: "Box Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.boxMaker)),
            energyCost: 3,
            tick: 1,
            inputs: {
                plank: {
                    amount: 2
                }
            },
            outputs: {
                box: {
                    amount: 2
                }
            }
        } as FactoryComponentDeclaration,
        blocks: {
            imageSrc: _blockMaker,
            key: "ctrl+1",
            name: "Wooden Block Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.blocks)),
            energyCost: 20,
            tick: 1,
            inputs: {
                plank: {
                    amount: 1
                }
            },
            outputs: {
                block: {
                    amount: computed(() => (upgrades[1][0].bought.value ? 3 : 1)),
                    resource: toys.woodenBlocks
                }
            }
        } as FactoryComponentDeclaration,
        clothes: {
            imageSrc: _clothesMaker,
            key: "ctrl+2",
            name: "Clothes Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.clothes)),
            energyCost: 20,
            tick: 1,
            inputs: {
                thread: {
                    amount: 2
                },
                cloth: {
                    amount: 3
                },
                dye: {
                    amount: 1
                }
            },
            outputs: {
                clothes: {
                    amount: 1,
                    resource: toys.clothes
                }
            }
        } as FactoryComponentDeclaration,
        trucks: {
            imageSrc: _truckMaker,
            key: "ctrl+3",
            name: "Trucks Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.trucks)),
            energyCost: 20,
            tick: 1,
            inputs: {
                metal: {
                    amount: 2
                },
                wheel: {
                    amount: 4
                }
            },
            outputs: {
                trucks: {
                    amount: 1,
                    resource: toys.trucks
                }
            }
        } as FactoryComponentDeclaration,
        bear: {
            imageSrc: _bearMaker,
            key: "ctrl+4",
            name: "Teddy Bear Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.bear)),
            energyCost: 20,
            tick: 1,
            inputs: {
                thread: {
                    amount: 1
                },
                stuffing: {
                    amount: 1
                },
                dye: {
                    amount: 1
                },
                buttons: {
                    amount: 3
                }
            },
            outputs: {
                bear: {
                    amount: computed(() => (upgrades[1][3].bought.value ? 2 : 1)),
                    resource: noPersist(bears)
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        bucketShovel: {
            imageSrc: _bucketShovelMaker,
            key: "ctrl+5",
            name: "Shovel and Pail Maker",
            type: "processor",
            description: computed(() =>
                generateComponentDescription(FACTORY_COMPONENTS.bucketShovel)
            ),
            energyCost: 20,
            tick: 1,
            inputs: {
                bucket: {
                    amount: 1
                },
                shovel: {
                    amount: 1
                }
            },
            outputs: {
                shovelBucket: {
                    amount: 1,
                    resource: noPersist(bucketAndShovels)
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        console: {
            imageSrc: _consoleMaker,
            key: "ctrl+6",
            name: "Game Console Maker",
            type: "processor",
            description: computed(() => generateComponentDescription(FACTORY_COMPONENTS.console)),
            energyCost: 20,
            tick: 1,
            inputs: {
                metal: {
                    amount: 1
                },
                plastic: {
                    amount: 3
                },
                circuitBoard: {
                    amount: 1
                }
            },
            outputs: {
                console: {
                    amount: computed(() => (upgrades[1][3].bought.value ? 3 : 1)),
                    resource: noPersist(consoles)
                }
            },
            visible: main.days[advancedDay - 1].opened
        } as FactoryComponentDeclaration,
        present: {
            imageSrc: _presentMaker,
            type: "processor",
            // idk about this
            key: "ctrl+7",
            name: "Present Wrapper",
            description: computed(
                () =>
                    `Takes in 4 dye, 4 plastic, 1 cloth, 2 boxes, and ${formatWhole(
                        computedToyMultiplier.value
                    )} toys of any type (from storage) to produce ${formatWhole(
                        computedPresentMultipliers.value
                    )} presents every tick.`
            ),
            tick: 1,
            energyCost: 50,
            inputs: {
                dye: {
                    amount: 4
                },
                plastic: {
                    amount: 4
                },
                cloth: {
                    amount: 1
                },
                box: {
                    amount: 2
                }
            },
            catalysts: computed(() => {
                if (!catalysts.bought.value) return [] as ResourceNames[];
                return ["block", "clothes", "trucks", "bear", "shovelBucket", "console"];
            }),
            canProduce: computed(() => {
                return Object.values(allToys).some(i =>
                    Decimal.gte(i.value, computedToyMultiplier.value)
                );
            }),
            onProduce(times, stock) {
                const value = Object.values(allToys);

                // TODO: use catalysts to multiply present gain
                // catalysts are essentally excess inputs

                while (times > 0) {
                    while (Decimal.lt(value[toysIndex].value, computedToyMultiplier.value)) {
                        toysIndex = (toysIndex + 1) % value.length;
                    }
                    const toyToPick = Object.values(allToys)[toysIndex];
                    toysIndex = (toysIndex + 1) % value.length;
                    toyToPick.value = Decimal.sub(toyToPick.value, computedToyMultiplier.value);
                    times--;
                    presents.value = Decimal.add(presents.value, computedPresentMultipliers.value);
                }
            },
            visible: main.days[presentsDay - 1].opened
        } as FactoryComponentDeclaration
    } as Record<string, FactoryComponentDeclaration>;
    const RESOURCES = {
        // Raw resources
        wood: {
            name: "Wood",
            imageSrc: _wood
        },
        cloth: {
            name: "Cloth",
            imageSrc: _cloth
        },
        dye: {
            name: "Dye",
            imageSrc: _dye
        },
        plastic: {
            name: "Plastic",
            imageSrc: _plastic
        },
        metal: {
            name: "Metal",
            imageSrc: _metal
        },
        // Processed resources
        plank: {
            name: "Planks",
            imageSrc: _plank
        },
        box: {
            name: "Boxes",
            imageSrc: _box
        },
        thread: {
            name: "Thread",
            imageSrc: _thread
        },
        wheel: {
            name: "Wheels",
            imageSrc: _wheel
        },
        buttons: {
            name: "Buttons",
            imageSrc: _button
        },
        stuffing: {
            name: "Stuffing",
            imageSrc: _stuffing
        },
        shovel: {
            name: "Shovel",
            imageSrc: _shovel
        },
        bucket: {
            name: "Bucket",
            imageSrc: _bucket
        },
        circuitBoard: {
            name: "Circuit Board",
            imageSrc: _circuitBoard
        },
        // Toys
        block: {
            name: "Wooden Blocks",
            imageSrc: _block
        },
        clothes: {
            name: "Clothes",
            imageSrc: _clothes
        },
        trucks: {
            name: "Trucks",
            imageSrc: _truck
        },
        bear: {
            name: "Teddy Bear",
            imageSrc: _bear
        },
        shovelBucket: {
            name: "Shovel and Pail",
            imageSrc: _bucketShovel
        },
        console: {
            name: "Game Console",
            imageSrc: _console
        }
    } as const;

    const hotkeys = (Object.keys(FACTORY_COMPONENTS) as FactoryCompNames[]).reduce((acc, comp) => {
        acc[comp] = createHotkey(() => ({
            key: FACTORY_COMPONENTS[comp].key,
            description: "Select " + FACTORY_COMPONENTS[comp].name,
            onPress() {
                compSelected.value = comp;
            },
            enabled: noPersist(main.days[day - 1].opened)
        }));
        return acc;
    }, {} as Record<FactoryCompNames, GenericHotkey>);

    type FactoryCompNames = keyof typeof FACTORY_COMPONENTS;
    type BuildableCompName = Exclude<FactoryCompNames, "cursor">;
    type ResourceNames = keyof typeof RESOURCES;

    interface FactoryComponentBase extends Record<string, State> {
        direction: Direction;
    }

    interface FactoryComponentProcessor extends FactoryComponentBase {
        type: Exclude<BuildableCompName, "conveyor">;
        inputStock?: Partial<Record<ResourceNames, number>>;

        // current production stock
        outputStock?: Partial<Record<ResourceNames, number>>;
        ticksDone: number;
    }

    interface FactoryComponentConveyor extends FactoryComponentBase {
        type: "conveyor";
    }

    type FactoryComponent = FactoryComponentBase &
        (FactoryComponentConveyor | FactoryComponentProcessor);

    type Stock = Partial<
        Record<
            ResourceNames,
            {
                amount: ProcessedComputable<number>;
                capacity?: number;
                resource?: Resource;
            }
        >
    >;

    interface FactoryComponentDeclaration {
        tick: number;
        key: string;
        imageSrc: string;
        extraImage?: string;
        name: string;
        type: "command" | "conveyor" | "processor";
        description: ProcessedComputable<string>;
        energyCost?: number;
        visible?: ProcessedComputable<boolean>;

        /** amount it consumes */
        inputs?: Stock;
        /** amount it produces */
        outputs?: Stock;
        catalysts?: ProcessedComputable<ResourceNames[]>;

        /** on produce, do something */
        onProduce?: (
            times: number,
            stock: Partial<Record<ResourceNames, number>> | undefined
        ) => void;
        /** can it produce? (in addtion to the stock check) */
        canProduce?: ComputedRef<boolean>;
    }

    interface FactoryInternalBase {
        sprite: Sprite;
        canProduce: ComputedRef<boolean>;
    }
    interface FactoryInternalConveyor extends FactoryInternalBase {
        type: "conveyor";

        // packages are sorted by last first, first last
        // [componentMade5SecondsAgo, componentMade4SecondsAgo...]
        packages: Block[];
        nextPackages: Block[];
    }
    interface FactoryInternalProcessor extends FactoryInternalBase {
        type: Exclude<BuildableCompName, "conveyor">;
        lastProdTimes: number[];

        lastFactoryProd: number;
        average: ComputedRef<number | undefined>;
    }
    type FactoryInternal = FactoryInternalConveyor | FactoryInternalProcessor;

    interface Block {
        sprite: Sprite;
        type: ResourceNames;
        // in block amts, not screen
        x: number;
        y: number;
        // make blocks turn in random amounts;
        turbulance: number;
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

    const compSelected = ref<FactoryCompNames>("cursor");
    const components: Persistent<{ [key: string]: FactoryComponent }> = persistent({});
    const compInternalData: Record<string, FactoryInternal> = {};

    // trained elves

    const costCheapener = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.add(presents.value, 1).log10().add(1),
            description: "Excitment Upgrade",
            enabled: excitmentUpgrade.bought
        }))
    ]);
    const computedCostCheapeners = computed(() => costCheapener.apply(1));

    const clothesBuyable = createBuyable(() => ({
        resource: toys.clothes,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make clothes",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px"
    }));
    const blocksBuyable = createBuyable(() => ({
        resource: toys.woodenBlocks,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make wooden blocks",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px"
    }));
    const trucksBuyable = createBuyable(() => ({
        resource: toys.trucks,
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make toy trucks",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px"
    }));
    const bearsBuyable = createBuyable(() => ({
        resource: noPersist(bears),
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make bears",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px",
        visible: () => showIf(main.days[advancedDay - 1].opened.value)
    }));
    const bucketBuyable = createBuyable(() => ({
        resource: noPersist(bucketAndShovels),
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make shovel and pails",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px",
        visible: () => showIf(main.days[advancedDay - 1].opened.value)
    }));
    const consolesBuyable = createBuyable(() => ({
        resource: noPersist(consoles),
        cost() {
            return Decimal.pow(2, Decimal.add(this.amount.value, 5)).div(
                computedCostCheapeners.value
            );
        },
        display: {
            title: "Train elves to make consoles",
            description: "Use your finished toys to train an elf on factory work"
        },
        style: "width: 110px",
        visible: () => showIf(main.days[advancedDay - 1].opened.value)
    }));
    const elfBuyables = {
        clothesBuyable,
        blocksBuyable,
        trucksBuyable,
        bearsBuyable,
        bucketBuyable,
        consolesBuyable
    };

    const sumElves = computed(() =>
        Object.values(elfBuyables)
            .map(b => b.amount.value)
            .reduce(Decimal.add, 0)
    );
    const trainedElves = createResource<DecimalSource>(sumElves, "trained elves");
    const elvesEffect = computed(() => Decimal.pow(1.05, trainedElves.value));

    const expandFactory = createBuyable(() => ({
        resource: trees.logs,
        cost() {
            return Decimal.pow(1e4, this.amount.value).times(1e72);
        },
        display: {
            title: "Expand Factory",
            description:
                "Use some surplus wood to slightly expand the walls of your factory. Also add +100% to the max workshop size",
            effectDisplay: jsx(() => (
                <>+{formatWhole(expandFactory.amount.value)} each dimension</>
            )),
            showAmount: false
        },
        style: "width: 200px",
        visibility: () => showIf(main.days[advancedDay - 1].opened.value)
    })) as GenericBuyable;
    const oilFuel = createBuyable(() => ({
        resource: oil.oil,
        cost() {
            return Decimal.pow(10, this.amount.value).times(1e23);
        },
        display: {
            title: "Oil Fuel",
            description: "Use some surplus oil to generate more electricity",
            effectDisplay: jsx(() => <>+{formatWhole(Decimal.times(oilFuel.amount.value, 10))}</>),
            showAmount: false
        },
        style: "width: 200px",
        visibility: () => showIf(main.days[advancedDay - 1].opened.value)
    })) as GenericBuyable;
    const carryToys = createBuyable(() => ({
        resource: boxes.boxes,
        cost() {
            return Decimal.pow(100, this.amount.value).times(1e80);
        },
        display: {
            title: "Carry toys in boxes",
            description: "Use some surplus boxes to speed up the whole factory",
            effectDisplay: jsx(() => (
                <>x{format(Decimal.div(carryToys.amount.value, 10).add(1))} tick rate</>
            )),
            showAmount: false
        },
        style: "width: 200px",
        visibility: () => showIf(main.days[advancedDay - 1].opened.value)
    })) as GenericBuyable;

    const betterFactory = createUpgrade(() => ({
        resource: noPersist(presents),
        cost: 100,
        display: {
            title: "Factory eXPerience",
            description: "Factory size is increased by 5."
        },
        visibility: () => showIf(main.days[presentsDay - 1].opened.value)
    }));
    const betterLighting = createUpgrade(() => ({
        resource: noPersist(presents),
        cost: 300,
        display: {
            title: "Burn some logs",
            description: "More energy needed? Let's burn some logs! Logs boosts maximum energy.",
            effectDisplay: jsx(() => (
                <>x{format(Decimal.log10(trees.logs.value).div(100).add(1))}</>
            ))
        },
        visibility: () => showIf(betterFactory.bought.value)
    }));
    const excitmentUpgrade = createUpgrade(() => ({
        resource: noPersist(presents),
        cost: 1000,
        display: {
            title: "Faster Elf Training",
            description:
                "Apparently elves like presents. Let's use it to train them to work on the factory faster! Presents divides the requirement for factory elf training.",
            effectDisplay: jsx(() => <>/{format(Decimal.add(presents.value, 1).log10().add(1))}</>)
        },
        visibility: () => showIf(betterLighting.bought.value)
    }));
    const carryPresents = createUpgrade(() => ({
        resource: noPersist(presents),
        cost: 5000,
        display: {
            title: "Carrying more stuff in boxes",
            description:
                "Boxes seem really useful for carrying stuff. Why don't we use them to carry presents as well? Unlocks 2 new buyables (one of them is in the boxes layer)."
        },
        visibility: () => showIf(excitmentUpgrade.bought.value)
    }));
    const carryBoxes = createBuyable(() => ({
        resource: noPersist(presents),
        cost() {
            return Decimal.add(carryBoxes.amount.value, 1)
                .pow(1.5)
                .mul(Decimal.pow(2, carryBoxes.amount.value))
                .mul(1000);
        },
        style: "width: 400px",
        display: {
            title: "Carry boxes in... presents?",
            description:
                "Presents are made out of boxes, so shouldn't they be able to hold boxes as well? Apparently it makes the boxes more durable. Each level multiplies boxes gain by 1.5.",
            effectDisplay: jsx(() => <>x{format(Decimal.pow(1.5, carryBoxes.amount.value))}</>)
        },
        visibility: () => showIf(carryPresents.bought.value)
    })) as GenericBuyable;
    const catalysts = createUpgrade(() => ({
        resource: noPersist(presents),
        cost: 10000,
        display: {
            title: "Better Presents",
            description:
                "Instead of trying to make more presents, how about we make the ones we make better? Unlocks catalysts for the present maker."
        },
        visibility: () => showIf(carryPresents.bought.value)
    }));
    const factoryBuyables = { expandFactory, oilFuel, carryToys };
    const factoryBuyables2 = { carryBoxes };
    const upgrades = [
        [
            createUpgrade(() => ({
                resource: trees.logs,
                cost: () => Decimal.pow(5, upgradeAmount.value).mul(1e75),
                display: {
                    title: "Sawmill Efficiency",
                    description:
                        "Double sawmill consumption and production and metal supplier efficiency"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: paper.paper,
                cost: () => Decimal.pow(5, upgradeAmount.value).mul(1e90),
                display: {
                    title: "News Ticker",
                    description: "Paper boosts tick speed"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: toys.trucks,
                cost: () => Decimal.pow(1.2, upgradeAmount.value).mul(1000),
                display: {
                    title: "Haul wood in trucks",
                    description: "Trucks multiply wood gain"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: metal.metal,
                cost: () => Decimal.pow(3, upgradeAmount.value).mul(1e53),
                display: {
                    title: "Diamond-tipped drills",
                    description: "Drill power ^1.2"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            }))
        ],
        [
            createUpgrade(() => ({
                resource: toys.woodenBlocks,
                cost: () => Decimal.pow(1.2, upgradeAmount.value).mul(2000),
                display: {
                    title: "Larger wood pieces",
                    description: "Wooden block producers produce 3x as much"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: dyes.dyes.red.amount,
                cost: () => Decimal.pow(1.5, upgradeAmount.value).mul(4e16),
                display: {
                    title: "Colorful clothes",
                    description: "Dye producers produce 4x as much"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: plastic.plastic,
                cost: () => Decimal.pow(2, upgradeAmount.value).mul(1e17),
                display: {
                    title: "Improved plastic producers",
                    description: "Plastic producers produce 4x as much"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: oil.oil,
                cost: () => Decimal.pow(1.5, upgradeAmount.value).mul(1e22),
                display: {
                    title: "Capitalism",
                    description: "Console production is tripled"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            }))
        ],
        [
            createUpgrade(() => ({
                resource: coal.coal,
                cost: () => Decimal.pow(5, upgradeAmount.value).mul(1e130),
                display: {
                    title: "Brighter work rooms",
                    description: "Unused electricity makes ticks faster"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: dyes.dyes.blue.amount,
                cost: () => Decimal.pow(1.4, upgradeAmount.value).mul(1e15),
                display: {
                    title: "Colorful teddy bears",
                    description: "Teddy bears produce 2x as much"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: dyes.dyes.black.amount,
                cost: () => Decimal.pow(1.5, upgradeAmount.value).mul(1e6),
                display: {
                    title: "New Colors",
                    description: "Unlock white dye"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            })),
            createUpgrade(() => ({
                resource: boxes.boxes,
                cost: () => Decimal.pow(3, upgradeAmount.value).mul(1e80),
                display: {
                    title: "Carry ticks in boxes",
                    description: "Tick speed x1.5"
                },
                visibility: () => showIf(main.days[advancedDay - 1].opened.value)
            }))
        ],
        [betterFactory, betterLighting, excitmentUpgrade, carryPresents],
        [catalysts]
    ];

    // pixi
    const upgradeAmount = computed(
        () => upgrades.flat().filter(u => u.bought.value).length
    ) as ComputedRef<number>;
    // load every sprite here so pixi doesn't complain about loading multiple times
    const assetsLoading = Promise.all([
        Assets.load(Object.values(FACTORY_COMPONENTS).map(x => x.imageSrc)),
        Assets.load(
            Object.values(FACTORY_COMPONENTS)
                .map(x => x.extraImage)
                .filter(x => x != null) as string[]
        ),
        Assets.load(Object.values(RESOURCES).map(x => x.imageSrc))
    ]);

    const app = new Application({
        backgroundAlpha: 0
    });
    const graphicContainer = new Graphics();
    let spriteContainer = new Container();
    const movingBlocks = new Container();
    let hoverSprite = new Sprite();

    spriteContainer.zIndex = 0;
    movingBlocks.zIndex = 1;
    graphicContainer.zIndex = 2;
    app.stage.addChild(graphicContainer, spriteContainer, movingBlocks);
    app.stage.sortableChildren = true;
    let loaded = false;

    globalBus.on("onLoad", async () => {
        if (loaded) {
            return;
        }
        loaded = false;

        spriteContainer.destroy({
            children: true
        });
        spriteContainer = new Container();
        app.stage.addChild(spriteContainer);

        const floorGraphics = new Graphics();
        spriteContainer.addChild(floorGraphics);

        watchEffect(() => {
            floorGraphics.clear();
            floorGraphics.beginFill(0x70645d);
            floorGraphics.drawRect(
                (-computedFactorySize.value * blockSize) / 2,
                (-computedFactorySize.value * blockSize) / 2,
                computedFactorySize.value * blockSize,
                computedFactorySize.value * blockSize
            );
            floorGraphics.endFill();
        });

        await assetsLoading;

        if (Array.isArray(components.value)) {
            components.value = {};
        } else {
            for (const id in components.value) {
                const data = components.value[id];
                if (data?.type === undefined) {
                    delete components.value[id];
                    continue;
                }
                const [x, y] = id.split("x").map(p => +p);
                addFactoryComp(x, y, data);
            }
        }

        loaded = true;
        watchEffect(updateGraphics);
    });

    function moveBlock(block: Block, newBlock: FactoryInternal, blockData: FactoryComponent) {
        // empty spot
        if (newBlock === undefined) {
            // just delete it
            movingBlocks.removeChild(block.sprite);
        } else if (newBlock.type === "conveyor") {
            // push it to the next conveyor, kill it from the
            // curent conveyor
            block.turbulance = Math.random() * 0.4 - 0.2;
            (newBlock as FactoryInternalConveyor).nextPackages.push(block);
        } else {
            // send it to the factory
            // destroy its sprite and data
            const factoryData = blockData as FactoryComponentProcessor;
            if (factoryData.inputStock !== undefined) {
                factoryData.inputStock[block.type] = Math.min(
                    (factoryData.inputStock[block.type] ?? 0) + 1,
                    FACTORY_COMPONENTS[newBlock.type].inputs?.[block.type]?.capacity ?? Infinity
                );
            }
            movingBlocks.removeChild(block.sprite);
        }
    }

    globalBus.on("update", diff => {
        if (!loaded || paused.value) return;

        const factoryTicks = Decimal.times(computedActualTickRate.value, diff).toNumber();

        for (const id in components.value) {
            const [x, y] = id.split("x").map(p => +p);
            const _data = components.value[id];
            const _compData = compInternalData[id];
            if (_data === undefined || _compData === undefined) continue;
            const factoryData = FACTORY_COMPONENTS[_data.type];
            // debugger;
            if (_data.type === "conveyor") {
                const data = _data as FactoryComponentConveyor;
                const compData = _compData as FactoryInternalConveyor;
                if (compData.type !== "conveyor") throw new TypeError("this should not happen");
                // conveyor part
                // use a copy
                compData.packages = compData.packages.concat(compData.nextPackages);
                compData.nextPackages = [];
                for (let key = 0; key < compData.packages.length; key++) {
                    const block = compData.packages[key];
                    const inputDirection = data.direction;
                    const dirType = getDirection(inputDirection);
                    const dirAmt = directionToNum(inputDirection);
                    if (dirType === "h") {
                        if ((block.x - x) * dirAmt >= 1 + block.turbulance) {
                            const compBehind = compInternalData[x + dirAmt + "x" + y];
                            const storedComp = components.value[x + dirAmt + "x" + y];

                            moveBlock(block, compBehind, storedComp);

                            compData.packages.splice(key, 1);
                            key--;
                        } else {
                            const change =
                                dirAmt *
                                Math.min(Math.abs(x + 1.3 * dirAmt - block.x), factoryTicks);
                            block.x += change;
                            block.sprite.x += change * blockSize;
                        }
                    } else {
                        if ((block.y - y) * dirAmt >= 1 + block.turbulance) {
                            const compBehind = compInternalData[x + "x" + (y + dirAmt)];
                            const storedComp = components.value[x + "x" + (y + dirAmt)];

                            moveBlock(block, compBehind, storedComp);

                            compData.packages.splice(key, 1);
                            key--;
                        } else {
                            const change =
                                dirAmt *
                                Math.min(Math.abs(y + 1.3 * dirAmt - block.y), factoryTicks);
                            block.y += change;
                            block.sprite.y += change * blockSize;
                        }
                    }
                }
            } else {
                const data = _data as FactoryComponentProcessor;
                const compData = _compData as FactoryInternalProcessor;
                // factory part
                // PRODUCTION
                if (data.ticksDone >= factoryData.tick) {
                    if (compData.canProduce.value) {
                        const cyclesDone = Math.floor(data.ticksDone / factoryData.tick);
                        factoryData.onProduce?.(cyclesDone, data.inputStock);
                        if (factoryData.inputs !== undefined) {
                            if (data.inputStock === undefined) data.inputStock = {};
                            for (const [key, val] of Object.entries(factoryData.inputs)) {
                                data.inputStock[key as ResourceNames] =
                                    (data.inputStock[key as ResourceNames] ?? 0) -
                                    unref(val.amount);
                            }
                        }
                        if (factoryData.outputs !== undefined) {
                            if (data.outputStock === undefined) data.outputStock = {};
                            for (const [key, val] of Object.entries(factoryData.outputs)) {
                                if (val.resource != null) {
                                    val.resource.value = Decimal.add(
                                        val.resource.value,
                                        Decimal.times(
                                            computedToyMultiplier.value,
                                            unref(val.amount)
                                        )
                                    );
                                } else {
                                    data.outputStock[key as ResourceNames] =
                                        (data.outputStock[key as ResourceNames] ?? 0) +
                                        unref(val.amount);
                                }
                            }
                        }
                        data.ticksDone -= cyclesDone * factoryData.tick;
                        const now = Date.now();
                        const diff = (now - compData.lastFactoryProd) / 1000;
                        compData.lastProdTimes.push(diff);
                        if (compData.lastProdTimes.length > 10) compData.lastProdTimes.shift();
                        compData.lastFactoryProd = now;
                    }
                } else {
                    data.ticksDone += factoryTicks;
                }
                // now look at each component direction and see if it accepts items coming in
                // components are 1x1 so simple math for now

                const incs: [number, number][] = [];
                if (
                    components.value[x + "x" + (y + 1)]?.type === "conveyor" &&
                    components.value[x + "x" + (y + 1)].direction === Direction.Down
                ) {
                    incs.push([0, 1]);
                }
                if (
                    components.value[x + "x" + (y - 1)]?.type === "conveyor" &&
                    components.value[x + "x" + (y - 1)].direction === Direction.Up
                ) {
                    incs.push([0, -1]);
                }
                if (
                    components.value[x + 1 + "x" + y]?.type === "conveyor" &&
                    components.value[x + 1 + "x" + y].direction === Direction.Right
                ) {
                    incs.push([1, 0]);
                }
                if (
                    components.value[x - 1 + "x" + y]?.type === "conveyor" &&
                    components.value[x - 1 + "x" + y].direction === Direction.Left
                ) {
                    incs.push([-1, 0]);
                }
                // no suitable location to dump stuff in
                // console.log(x, y);
                // debugger;
                if (incs.length <= 0) continue;
                const [xInc, yInc] = incs[Math.floor(Math.random() * incs.length)];
                let itemToMove: [ResourceNames, number] | undefined = undefined;
                if (data.outputStock !== undefined) {
                    for (const [name, amt] of Object.entries(data.outputStock)) {
                        if (amt >= 1) {
                            itemToMove = [name as ResourceNames, amt];
                            data.outputStock[name as ResourceNames]!--;
                            break;
                        }
                    }
                }
                // there is nothing to move
                if (itemToMove === undefined) continue;
                const texture = Assets.get(RESOURCES[itemToMove[0]].imageSrc);
                const sprite = new Sprite(texture);

                /*
                    go left     go right
                              go top
                                x
                    default -> CCC
                             x CCC x
                               CCC
                                x
                              go bottom
                    */
                // if X is being moved, then we don't need to adjust x
                // however it needs to be aligned if Y is being moved
                // vice-versa
                const factorySizeOffset = computedFactorySize.value % 2 === 0 ? blockSize / 2 : 0;
                sprite.x =
                    (x + xInc * 0.3 + (xInc == 0 ? Math.random() * 0.4 - 0.2 : 0)) * blockSize +
                    factorySizeOffset;
                sprite.y =
                    (y + yInc * 0.3 + (yInc == 0 ? Math.random() * 0.4 - 0.2 : 0)) * blockSize +
                    factorySizeOffset;
                sprite.anchor.set(0.5);
                sprite.width = blockSize / 2.5;
                sprite.height = blockSize / 2.5;
                //console.log(sprite);
                const block: Block = {
                    sprite,
                    x: sprite.x / blockSize,
                    y: sprite.y / blockSize,
                    turbulance: Math.random() * 0.4 - 0.2,
                    type: itemToMove[0]
                };

                (
                    compInternalData[x + xInc + "x" + (y + yInc)] as FactoryInternalConveyor
                ).nextPackages.push(block);
                movingBlocks.addChild(sprite);
            }
        }
    });

    function addFactoryComp(
        x: number,
        y: number,
        data: Partial<FactoryComponent> & { type: BuildableCompName }
    ) {
        if (x < -computedFactorySize.value / 2 || x >= computedFactorySize.value / 2) return;
        if (y < -computedFactorySize.value / 2 || y >= computedFactorySize.value / 2) return;

        const factoryBaseData = FACTORY_COMPONENTS[data.type];
        if (factoryBaseData == undefined) return;
        const sheet = Assets.get(factoryBaseData.imageSrc);

        const sprite = new Sprite(sheet);

        watchEffect(() => {
            if (computedFactorySize.value % 2 === 0) {
                sprite.x = (x + 0.5) * blockSize;
                sprite.y = (y + 0.5) * blockSize;
            } else {
                sprite.x = x * blockSize;
                sprite.y = y * blockSize;
            }
        });
        sprite.width = blockSize;
        sprite.height = blockSize;
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        sprite.rotation =
            ([Direction.Right, Direction.Down, Direction.Left, Direction.Up].indexOf(
                data.direction ?? Direction.Right
            ) *
                Math.PI) /
            2;

        if (factoryBaseData.extraImage != null) {
            const sheet = Assets.get(factoryBaseData.extraImage);
            const extraSprite = new Sprite(sheet);
            extraSprite.width = blockSize / 3;
            extraSprite.height = blockSize / 3;
            extraSprite.position.set(-blockSize / 3, 0);
            sprite.addChild(extraSprite);
        }
        components.value[x + "x" + y] = {
            ticksDone: 0,
            direction: Direction.Right,
            inputStock:
                factoryBaseData.inputs === undefined
                    ? undefined
                    : Object.fromEntries(
                          Object.entries(factoryBaseData.inputs).map(x => [x[0], 0])
                      ),
            outputStock:
                factoryBaseData.outputs === undefined
                    ? undefined
                    : Object.fromEntries(
                          Object.entries(factoryBaseData.outputs).map(x => [x[0], 0])
                      ),
            ...data
        } as FactoryComponent;
        const isConveyor = data.type === "conveyor";
        compInternalData[x + "x" + y] = {
            type: data.type,
            packages: isConveyor ? [] : undefined,
            nextPackages: isConveyor ? [] : undefined,
            lastProdTimes: !isConveyor ? (reactive([]) as number[]) : undefined,
            lastFactoryProd: !isConveyor
                ? Date.now() -
                  1000 *
                      Decimal.div(
                          (data as FactoryComponentProcessor).ticksDone ?? 0,
                          computedActualTickRate.value
                      ).toNumber()
                : undefined,
            average: !isConveyor
                ? computed(() => {
                      const times = (compInternalData[x + "x" + y] as FactoryInternalProcessor)
                          .lastProdTimes;
                      if (times.length === 0) return undefined;

                      // times is in SECONDS, not ticks
                      // seconds * Ticks per second -> ticks taken

                      return Decimal.mul(times.length, factoryBaseData.tick)
                          .div(times.reduce((x, n) => x + n, 0))
                          .div(computedActualTickRate.value)
                          .toNumber();
                  })
                : undefined,
            canProduce: computed(() => {
                if (data.type === "conveyor") return true;
                if (!(factoryBaseData.canProduce?.value ?? true)) return false;
                // this should NEVER be null
                const compData = components.value[x + "x" + y] as FactoryComponentProcessor;
                if (factoryBaseData.inputs !== undefined) {
                    for (const [res, val] of Object.entries(factoryBaseData.inputs))
                        if ((compData.inputStock?.[res as ResourceNames] ?? 0) < unref(val.amount))
                            return false;
                }
                if (factoryBaseData.outputs !== undefined) {
                    for (const [res, val] of Object.entries(factoryBaseData.outputs))
                        if (
                            (compData.outputStock?.[res as ResourceNames] ?? 0) +
                                unref(val.amount) >
                            (val.capacity ?? Infinity)
                        )
                            return false;
                }
                return true;
            }),
            sprite
        } as FactoryInternalProcessor;
        spriteContainer.addChild(sprite);
    }

    function removeFactoryComp(x: number, y: number) {
        const data = compInternalData[x + "x" + y];
        if (data === undefined) return;

        if (data.type === "conveyor") {
            const cData = data as FactoryInternalConveyor;
            for (const p of cData.packages) {
                p.sprite.destroy();
            }
        }

        delete components.value[x + "x" + y];
        delete compInternalData[x + "x" + y];
        spriteContainer.removeChild(data.sprite);
    }

    // draw graphics
    function updateGraphics() {
        app.resize();
        graphicContainer.clear();
        // make (0, 0) the center of the screen
        const calculatedX = mapOffset.x * blockSize + app.view.width / 2;
        const calculatedY = mapOffset.y * blockSize + app.view.height / 2;

        spriteContainer.x = movingBlocks.x = calculatedX;
        spriteContainer.y = movingBlocks.y = calculatedY;

        graphicContainer.removeChild(hoverSprite);
        if (isMouseHoverShown.value && compSelected.value !== "cursor") {
            // Offset half a block if factory size is even
            const factorySizeOffset = computedFactorySize.value % 2 === 0 ? blockSize / 2 : 0;
            const { tx, ty } = spriteContainer.localTransform;
            const x =
                roundDownTo(mouseCoords.x - tx, blockSize) + factorySizeOffset + tx - blockSize / 2;
            const y =
                roundDownTo(mouseCoords.y - ty, blockSize) + factorySizeOffset + ty - blockSize / 2;
            graphicContainer.lineStyle(4, 0x808080, 1);
            graphicContainer.drawRect(x, y, blockSize, blockSize);
            const factoryBaseData = FACTORY_COMPONENTS[compSelected.value];
            const sheet = Assets.get(factoryBaseData.imageSrc);
            hoverSprite = new Sprite(sheet);
            hoverSprite.x = x;
            hoverSprite.y = y;
            hoverSprite.width = blockSize;
            hoverSprite.height = blockSize;
            hoverSprite.alpha = 0.5;
            hoverSprite.alpha = 0.5;
            graphicContainer.addChild(hoverSprite);
        }
    }

    const pointerDown = ref(false),
        pointerDrag = ref(false),
        compHovered = ref<FactoryComponent | undefined>(undefined),
        compInternalHovered = shallowRef<FactoryInternal | undefined>(undefined),
        paused = ref(false);

    function onFactoryPointerMove(e: PointerEvent) {
        const { x, y } = getRelativeCoords(e);
        mouseCoords.x = x;
        mouseCoords.y = y;

        if (
            pointerDown.value &&
            (pointerDrag.value ||
                (compSelected.value === "cursor" &&
                    (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)))
        ) {
            pointerDrag.value = true;
            mapOffset.x += e.movementX / blockSize;
            mapOffset.y += e.movementY / blockSize;
            // the maximum you can see currently
            // total size of blocks - current size = amount you should move
            mapOffset.x = Math.min(
                Math.max(mapOffset.x, (-computedFactorySize.value + 1) / 2),
                (computedFactorySize.value + 1) / 2
            );
            mapOffset.y = Math.min(
                Math.max(mapOffset.y, (-computedFactorySize.value + 1) / 2),
                (computedFactorySize.value + 1) / 2
            );
        }
        if (!pointerDown.value && !pointerDrag.value) {
            const { tx, ty } = spriteContainer.localTransform;
            const xyPos =
                Math.round(roundDownTo(x - tx, blockSize) / blockSize) +
                "x" +
                Math.round(roundDownTo(y - ty, blockSize) / blockSize);
            compHovered.value = components.value[xyPos];
            compInternalHovered.value = compInternalData[xyPos];
        }
    }
    function onFactoryPointerDown(e: PointerEvent) {
        window.addEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = true;
        if (e.button === 1) {
            pointerDrag.value = true;
        }
    }
    function onFactoryPointerUp(e: PointerEvent) {
        // make sure they're not dragging and that
        // they aren't trying to put down a cursor
        if (!pointerDrag.value) {
            const { tx, ty } = spriteContainer.localTransform;
            let { x, y } = getRelativeCoords(e);
            x = roundDownTo(x - tx, blockSize) / blockSize;
            y = roundDownTo(y - ty, blockSize) / blockSize;
            if (e.button === 0) {
                if (compSelected.value === "rotateLeft") {
                    if (
                        components.value[x + "x" + y] != null &&
                        components.value[x + "x" + y].direction != null
                    ) {
                        components.value[x + "x" + y] = {
                            ...components.value[x + "x" + y],
                            direction: rotateDir(
                                (components.value[x + "x" + y] as FactoryComponentConveyor)
                                    .direction,
                                Direction.Left
                            )
                        };
                        compInternalData[x + "x" + y].sprite.rotation -= Math.PI / 2;
                    }
                } else if (compSelected.value === "rotateRight") {
                    if (
                        components.value[x + "x" + y] != null &&
                        components.value[x + "x" + y].direction != null
                    ) {
                        components.value[x + "x" + y] = {
                            ...components.value[x + "x" + y],
                            direction: rotateDir(
                                (components.value[x + "x" + y] as FactoryComponentConveyor)
                                    .direction,
                                Direction.Right
                            )
                        };
                        compInternalData[x + "x" + y].sprite.rotation += Math.PI / 2;
                    }
                } else if (compSelected.value === "delete") {
                    removeFactoryComp(x, y);
                } else if (compSelected.value !== "cursor") {
                    if (components.value[x + "x" + y] == null) {
                        addFactoryComp(x, y, { type: compSelected.value });
                    }
                }
            }
        }

        window.removeEventListener("pointerup", onFactoryPointerUp);
        pointerDown.value = pointerDrag.value = false;
        onFactoryPointerMove(e);
    }
    function onFactoryMouseEnter() {
        isMouseHoverShown.value = true;
    }
    function onFactoryMouseLeave() {
        isMouseHoverShown.value = false;
        compHovered.value = undefined;
    }

    function onCompClick(name: FactoryCompNames) {
        compSelected.value = name;
    }

    function setTracks() {
        for (const [key, comp] of Object.entries(compInternalData)) {
            if (comp == null) continue;
            if (comp.type === "conveyor") {
                const cComp = comp as FactoryInternalConveyor;
                for (const pkg of [...cComp.nextPackages, ...cComp.packages]) {
                    pkg.sprite.destroy();
                    movingBlocks.removeChild(pkg.sprite);
                }
                cComp.nextPackages = [];
                cComp.packages = [];
            } else {
                const producerComp = components.value[key] as FactoryComponentProcessor;
                const cComp = comp as FactoryInternalProcessor;
                if (producerComp.outputStock !== undefined) {
                    for (const key in producerComp.outputStock) {
                        delete producerComp.outputStock[key as ResourceNames];
                    }
                }
                if (producerComp.inputStock !== undefined) {
                    for (const key in producerComp.inputStock) {
                        delete producerComp.inputStock[key as ResourceNames];
                    }
                }
                producerComp.ticksDone = 0;
                cComp.lastFactoryProd = Date.now();
                cComp.lastProdTimes.splice(0, Infinity);
            }
        }
    }

    function clearFactory() {
        for (const key of Object.keys(compInternalData)) {
            const [x, y] = key.split("x").map(i => +i);
            removeFactoryComp(x, y);
        }
    }
    function moveToCenter() {
        mapOffset.x = 0;
        mapOffset.y = 0;
    }
    function togglePaused() {
        paused.value = !paused.value;
    }
    function handleDrag(drag: DragEvent, name: FactoryCompNames) {
        drag.dataTransfer!.setData("name", name);
    }
    function handleDrop(drag: DragEvent) {
        drag.preventDefault();
        const { tx, ty } = spriteContainer.localTransform;
        let { x, y } = getRelativeCoords(drag);
        x = roundDownTo(x - tx, blockSize) / blockSize;
        y = roundDownTo(y - ty, blockSize) / blockSize;
        const name = drag.dataTransfer!.getData("name");
        if (components.value[x + "x" + y] == null) {
            addFactoryComp(x, y, { type: name });
        }
    }

    // ------------------------------------------------------------------------------- Tabs

    const hovered = ref(false);
    const componentsList = jsx(() => {
        return (
            <div class={{ "comp-container": true, hovered: hovered.value }}>
                <div class="comp-list">
                    <div
                        class="comp-list-child"
                        onPointerenter={() => (hovered.value = true)}
                        onPointerleave={() => (hovered.value = false)}
                    >
                        {Object.entries(FACTORY_COMPONENTS).map(value => {
                            const key = value[0] as FactoryCompNames;
                            const item = value[1];
                            if (unref(item.visible) === false) {
                                return null;
                            }
                            return (
                                <div class="comp">
                                    <img
                                        src={item.imageSrc}
                                        class={{ selected: compSelected.value === key }}
                                        onClick={() => onCompClick(key)}
                                        draggable="true"
                                        onDragstart={drag => handleDrag(drag, key)}
                                    />
                                    {item.extraImage == null ? null : (
                                        <img src={item.extraImage} class="producedItem" />
                                    )}
                                    <div
                                        class={{
                                            "comp-info": true
                                        }}
                                    >
                                        <h3>
                                            {FACTORY_COMPONENTS[key].name + " "}
                                            <HotkeyVue hotkey={hotkeys[key]} />
                                        </h3>
                                        <br />
                                        {unref(FACTORY_COMPONENTS[key].description)}
                                        {FACTORY_COMPONENTS[key].energyCost ?? 0 ? (
                                            <>
                                                <br />
                                                Energy Consumption:{" "}
                                                {formatWhole(
                                                    FACTORY_COMPONENTS[key].energyCost ?? 0
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    });

    function showStockAmount(
        stocks: Partial<Record<ResourceNames, number>> | undefined | Record<string, never>,
        stockData: Stock | undefined,
        title: string,
        showAmount = true
    ) {
        if (stocks == null || stockData == null) {
            return undefined;
        }
        return (
            <>
                <br />
                <h5>{title}</h5>
                {(Object.keys(stockData) as ResourceNames[]).map(res => (
                    <div>
                        {RESOURCES[res]?.name}:{" "}
                        {stockData[res]?.resource != null
                            ? formatWhole(stockData[res]!.resource!.value)
                            : formatWhole(stocks[res] ?? 0)}
                        {showAmount && stockData[res]?.amount != undefined
                            ? " / " + formatWhole(unref(stockData[res]!.amount))
                            : ""}
                        {stockData[res]?.capacity != undefined
                            ? " / " + formatWhole(stockData[res]!.capacity!)
                            : ""}
                    </div>
                ))}
            </>
        );
    }

    const hoveredComponent = jsx(() => {
        if (compHovered.value == null || compInternalHovered.value == null) {
            return "";
        }
        const factorySizeOffset = computedFactorySize.value % 2 === 0 ? blockSize / 2 : 0;
        const x = mouseCoords.x + factorySizeOffset;
        const y = mouseCoords.y + factorySizeOffset;
        const onRight =
            x + (document.getElementById("factory-info")?.clientWidth ?? 0) > app.view.width - 30;
        const onTop =
            y + (document.getElementById("factory-info")?.clientHeight ?? 0) > app.view.height - 30;
        return (
            <div
                class="info-container"
                id="factory-info"
                style={{
                    ...(onRight ? { right: app.view.width - x + "px" } : { left: x + 148 + "px" }),
                    ...(onTop ? { bottom: app.view.height - y + "px" } : { top: y + "px" })
                }}
            >
                <h3>{FACTORY_COMPONENTS[compHovered.value.type].name}</h3>
                <br />
                {unref(FACTORY_COMPONENTS[compHovered.value.type].description)}
                <br />
                {compHovered.value.type !== "conveyor" &&
                compInternalHovered.value.type !== "conveyor" ? (
                    <>
                        {showStockAmount(
                            (compHovered.value as FactoryComponentProcessor).inputStock,
                            {
                                ...(FACTORY_COMPONENTS[compHovered.value.type].inputs ?? {}),
                                ...(FACTORY_COMPONENTS[compHovered.value.type].catalysts ?? {})
                            },
                            "Inputs:"
                        )}
                        {showStockAmount(
                            (compHovered.value as FactoryComponentProcessor).outputStock,
                            FACTORY_COMPONENTS[compHovered.value.type].outputs,
                            "Outputs:",
                            false
                        )}
                        <br />
                        Efficency:{" "}
                        {(compInternalHovered.value as FactoryInternalProcessor).average.value !==
                        undefined ? (
                            <span
                                style={{
                                    color:
                                        (compInternalHovered.value as FactoryInternalProcessor)
                                            .average.value! > 1
                                            ? "purple"
                                            : (
                                                  compInternalHovered.value as FactoryInternalProcessor
                                              ).average.value! >= 0.9
                                            ? "green"
                                            : (
                                                  compInternalHovered.value as FactoryInternalProcessor
                                              ).average.value! >= 0.5
                                            ? "yellow"
                                            : "red"
                                }}
                            >
                                {formatWhole(
                                    (compInternalHovered.value as FactoryInternalProcessor).average
                                        .value! * 100
                                )}
                            </span>
                        ) : (
                            "--"
                        )}
                        %
                    </>
                ) : undefined}
            </div>
        );
    });

    const tabs = createTabFamily(
        {
            dashboard: () => ({
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            <div>
                                {main.day.value === day
                                    ? `Reach ${format(toyGoal)} for each toy to complete the day`
                                    : main.day.value === advancedDay
                                    ? `Reach ${format(
                                          advancedToyGoal
                                      )} for each toy to complete the day`
                                    : main.day.value === presentsDay
                                    ? `Reach ${format(presentsGoal)} presents`
                                    : `${name} Complete!`}{" "}
                                -{" "}
                                <button
                                    class="button"
                                    style="display: inline-block;"
                                    onClick={() => (showModifiersModal.value = true)}
                                >
                                    Check Modifiers
                                </button>
                            </div>
                            {render(dayProgress)}
                            <Spacer />
                            <Row>
                                <Toy resource={toys.clothes} image={_clothes} color="lightblue" />
                                <Toy
                                    resource={toys.woodenBlocks}
                                    image={_block}
                                    color="cornflowerblue"
                                />
                                <Toy resource={toys.trucks} image={_truck} color="cadetblue" />
                                {main.days[advancedDay - 1].opened.value === true ? (
                                    <>
                                        <Toy resource={bears} image={_bear} color="teal" />
                                        <Toy
                                            resource={bucketAndShovels}
                                            image={_bucketShovel}
                                            color="cyan"
                                        />
                                        <Toy
                                            resource={consoles}
                                            image={_console}
                                            color="dodgerblue"
                                        />
                                    </>
                                ) : null}
                                {main.days[presentsDay - 1].opened.value === true ? (
                                    <>
                                        <Toy resource={presents} image={_present} color="green" />
                                    </>
                                ) : undefined}
                            </Row>
                            <Spacer />
                            <MainDisplay
                                resource={trainedElves}
                                color="green"
                                effectDisplay={`which improve the factory tick rate by ${format(
                                    elvesEffect.value
                                )}x`}
                            />
                            {renderRow(...Object.values(elfBuyables))}
                            <Spacer />
                            {renderGrid(
                                Object.values(factoryBuyables),
                                Object.values(factoryBuyables2)
                            )}
                            <Spacer />
                            <Spacer />
                            {renderGrid(...(upgrades as VueFeature[][]))}
                        </>
                    ))
                })),
                display: "Dashboard"
            }),
            factory: () => ({
                tab: createTab(() => ({
                    display: jsx(() => (
                        <>
                            {render(energyBar)}
                            <div class="factory-container">
                                <Factory
                                    application={app}
                                    onPointermove={onFactoryPointerMove}
                                    onPointerdown={onFactoryPointerDown}
                                    onPointerenter={onFactoryMouseEnter}
                                    onPointerleave={onFactoryMouseLeave}
                                    onContextmenu={(e: MouseEvent) => e.preventDefault()}
                                    onDrop={(e: DragEvent) => handleDrop(e)}
                                    onDragover={(e: DragEvent) => e.preventDefault()}
                                />
                                {componentsList()}
                                {hoveredComponent()}
                            </div>
                        </>
                    ))
                })),
                display: "Factory"
            })
        },
        () => ({
            classes: { "factory-tabs": true }
        })
    );

    const [generalTab, generalTabCollapsed] = createCollapsibleModifierSections(() => [
        {
            title: "Energy",
            modifier: energy,
            base: 0
        },
        {
            title: "Tick Rate",
            modifier: tickRate,
            base: 1,
            unit: "/s"
        },
        {
            title: "Present Multipliers",
            modifier: presentMultipliers,
            base: 1
        }
    ]);
    const showModifiersModal = ref(false);
    const modifiersModal = jsx(() => (
        <Modal
            modelValue={showModifiersModal.value}
            onUpdate:modelValue={(value: boolean) => (showModifiersModal.value = value)}
            v-slots={{
                header: () => <h2>{name} Modifiers</h2>,
                body: () => (
                    <>
                        {render(generalTab)}
                        {Decimal.gte(computedTickRate.value, 5) ? (
                            <>
                                <br />
                                Note: the actual tick rate is capped at 5 TPS, but you'll gain extra
                                toys based on excessive tick rate as compensation.{" "}
                                {main.days[presentsDay - 1].opened.value === true
                                    ? "Present maker's toy requirement and production is also affected by tick overflow."
                                    : undefined}
                            </>
                        ) : (
                            ""
                        )}
                    </>
                )
            }}
        />
    ));

    const dayProgress = createBar(() => ({
        direction: Direction.Right,
        width: 600,
        height: 25,
        fillStyle: `animation: 15s factory-bar linear infinite`,
        progress: () =>
            main.day.value === day
                ? Decimal.div(toys.clothes.value, toyGoal)
                      .clampMax(1)
                      .add(Decimal.div(toys.woodenBlocks.value, toyGoal).clampMax(1))
                      .add(Decimal.div(toys.trucks.value, toyGoal).clampMax(1))
                      .div(3)
                : main.day.value === advancedDay
                ? [toys.clothes, toys.woodenBlocks, toys.trucks, bears, bucketAndShovels, consoles]
                      .map(r => Decimal.div(r.value, advancedToyGoal).clampMax(1))
                      .reduce(Decimal.add, Decimal.dZero)
                      .div(6)
                : main.day.value === presentsDay
                ? Decimal.div(presents.value, presentsGoal).clampMax(1)
                : 1,
        display: jsx(() =>
            main.day.value === day ? (
                <>
                    {
                        [toys.clothes.value, toys.woodenBlocks.value, toys.trucks.value].filter(t =>
                            Decimal.gte(t, toyGoal)
                        ).length
                    }{" "}
                    / 3
                </>
            ) : main.day.value === advancedDay ? (
                <>
                    {
                        [
                            toys.clothes,
                            toys.woodenBlocks,
                            toys.trucks,
                            bears,
                            bucketAndShovels,
                            consoles
                        ].filter(d => Decimal.gte(d.value, advancedToyGoal)).length
                    }{" "}
                    / 6
                </>
            ) : main.day.value === presentsDay ? (
                <>
                    {formatWhole(presents.value)}/{formatWhole(presentsGoal)} presents
                </>
            ) : (
                ""
            )
        )
    })) as GenericBar;

    watchEffect(() => {
        if (
            main.day.value === day &&
            Decimal.gte(toys.clothes.value, toyGoal) &&
            Decimal.gte(toys.woodenBlocks.value, toyGoal) &&
            Decimal.gte(toys.trucks.value, toyGoal)
        ) {
            main.completeDay();
        } else if (
            main.day.value === advancedDay &&
            [
                toys.clothes,
                toys.woodenBlocks,
                toys.trucks,
                bears,
                bucketAndShovels,
                consoles
            ].filter(d => Decimal.gte(d.value, advancedToyGoal)).length >= 6
        ) {
            main.completeDay();
        } else if (main.day.value === presentsDay && Decimal.gte(presents.value, presentsGoal)) {
            main.completeDay();
        }
    });

    return {
        name,
        day,
        advancedDay,
        color,
        minWidth: 700,
        minimizable: true,
        style: { overflow: "hidden" },
        components,
        elfBuyables,
        bears,
        bucketAndShovels,
        consoles,
        presents,
        tabs,
        factoryBuyables,
        factoryBuyables2,
        carryBoxes,
        generalTabCollapsed,
        hotkeys,
        upgrades,
        display: jsx(() => (
            <>
                {render(modifiersModal)}
                {render(tabs as VueFeature)}
            </>
        ))
    };
});
export default factory;
