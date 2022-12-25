import { jsx } from "features/feature";
import { createLayer } from "game/layers"

const id = "credits"
const day = 25;
const name = "Credits"
const credits = createLayer(id, () => {
    
    return {
        display: jsx(() => 
            <div>
                TODO: layer
            </div>),
        name,
        day
    }
})