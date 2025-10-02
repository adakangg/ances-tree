/** Represents each family member node on tree */

export class Member {
    constructor({ 
        memberID, 
        level, 
        parentMarriage = 0, 
        marriage = 0, 
        isAddOnSpouse = false, 
        name, 
        image = "/assets/avatar1.png" 
    } = {}) {
        this.memberID = memberID;
        this.level = level;  
        this.parentMarriage = parentMarriage;
        this.marriage = marriage;
        this.isAddOnSpouse = isAddOnSpouse; 
        this.name = name;
        this.image = image;
    }   
}; 