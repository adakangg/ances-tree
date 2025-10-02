/** Records spouses in a marriage and their children */

export class Marriage {
    constructor({ marriageID, levelID, children = [], between = [] } = {}) {
        this.marriageID = marriageID;
        this.levelID = levelID;
        this.between = between;
        this.children = children;
    }  
}; 