import { Level } from "../classes/Level.js";
import { Marriage } from "../classes/Marriage.js";
import { Member } from "../classes/Member.js";

/** Functions used to establish relationships between family tree members */

/* Add Member Functions */ 
export function addParent(newParent, childID, members, levels) {    
    const child = members.get(childID);  
    if (child.isAddOnSpouse) throw new Error("Cannot add parents to this member");
    const parentMarr = getParentMarriage(child, levels);
    if (parentMarr.between.length === 2) throw new Error("Cannot add another parent");
   
    const isAddOnSpouse = child.level-1 >= 0 && firstSpouseIsMain(parentMarr, members);
    const parent = new Member({
        memberID: members.getNextID(),
        level: child.level-1,
        marriage: parentMarr.marriageID,
        isAddOnSpouse: isAddOnSpouse,
        ...newParent
    });  
    parentMarr.between.push(parent.memberID);
    members.set(parent.memberID, parent);  
}
 
export function addChild(newChild, parentID, members, levels) {
    const parent = members.get(parentID);    
    let childLvl = levels.get(parent.level+1);  
    if (!childLvl) {  
        childLvl = new Level({ levelID: parent.level+1 });  
        levels.set(childLvl.levelID, childLvl);  
    } 

    let parentMarr = getMarriage(levels, parent.marriage);
    if (!parentMarr) {  
        const parentLvl = levels.get(parent.level);
        parentMarr = new Marriage({
            marriageID: levels.getNextMarriageID(),
            levelID: parent.level,
            between: [parentID]
        });  
        parent.marriage = parentMarr.marriageID;
        levels.setMarriage(parentLvl.levelID, parentMarr.marriageID, parentMarr);
    }  

    const child = new Member({
        memberID: members.getNextID(),
        level: childLvl.levelID,
        parentMarriage: parent.marriage,  
        ...newChild
    });
    members.set(child.memberID, child);  
    parentMarr.children.push(child.memberID);
}
 
export function addSibling(newSiblingData, oldSiblingID, members, levels) {
    const oldSibling = members.get(oldSiblingID);
    if (oldSibling.isAddOnSpouse) throw new Error("Cannot add siblings to this member");
    const parentMarr = getParentMarriage(oldSibling, levels);
    const newSibling = new Member({
        memberID: members.getNextID(),
        level: oldSibling.level,
        parentMarriage: parentMarr.marriageID,
        ...newSiblingData
    });
    members.set(newSibling.memberID, newSibling);  
    parentMarr.children.push(newSibling.memberID);
}

export function addSpouse(newSpouseData, oldSpouseID, members, levels) {
    const oldSpouse = members.get(oldSpouseID);
    let marriage = getMarriage(levels, oldSpouse.marriage);  
    if (oldSpouse.isAddOnSpouse || marriage?.between.length === 2) {  
        throw new Error("Cannot add spouse to this member");
    };
    if (!marriage) { // create spouse marriage if non-existent
        marriage = new Marriage({
            marriageID: levels.getNextMarriageID(),
            levelID: oldSpouse.level,
            between: [oldSpouseID]
        });
        oldSpouse.marriage = marriage.marriageID;    
        const spouseLvl = levels.get(oldSpouse.level);
        levels.setMarriage(spouseLvl.levelID, marriage.marriageID, marriage);
    }

    const newSpouse = new Member({
        memberID: members.getNextID(),
        level: oldSpouse.level,
        marriage: oldSpouse.marriage,
        ...newSpouseData
    });  
    const user = members.get(1);
    const parentMarr = getMarriage(levels, user.parentMarriage);
    newSpouse.isAddOnSpouse = oldSpouse.level >= 0 || !isMainParent(parentMarr, oldSpouseID, members, levels);
    marriage.between.push(newSpouse.memberID);
    members.set(newSpouse.memberID, newSpouse);    
}


/** Delete Member Functions */ 
export function deleteMember(memberID, members, levels) {  
    if (memberID === 1) throw new Error("Cannot delete main user");
    const user = members.get(1);
    const parentMarr = getMarriage(levels, user.parentMarriage);  
    if (!isMainParent(parentMarr, memberID, members, levels)) {
        deleteMemberDown(memberID, members, levels);
    } else {
        deleteMemberUp(memberID, members, levels);
    }  
    deleteEmpty(members, levels);  
}

// deletes member & their descendants (add-on spouses/children)
function deleteMemberDown(memberID, members, levels) {
    const member = members.get(memberID);     
    const marriage = getMarriage(levels, member.marriage);
    if (marriage) {
        const spouse = getSpouse(memberID, marriage, members); 
        if (member.isAddOnSpouse) { 
            if (marriage.children.length === 0) spouse.marriage = 0; 
            marriage.between = [spouse.memberID]; 
        } else { // also delete member's spouse/children
            if (marriage.children.length > 0) {
                marriage.children.forEach(childID => deleteMemberDown(childID, members, levels));
            }  
            if (spouse) removeFromMembers(spouse, members, levels);
            marriage.between = [];
        }
    }
    removeFromMembers(member, members, levels);
}

// deletes member & their ancestors (add-on spouses/siblings/parents)
function deleteMemberUp(memberID, members, levels) {
    const member = members.get(memberID); 
    const marriage = getMarriage(levels, member.marriage);
    if (marriage) {
        marriage.between = marriage.between.filter(spouseID => spouseID !== memberID);
        const spouse = getSpouse(memberID, marriage, members);
        if (spouse?.isAddOnSpouse) deleteMemberDown(spouse.memberID, members, levels);
    };

    const parentMarr = getMarriage(levels, member.parentMarriage);  
    parentMarr?.children?.forEach(childID => { //delete member's siblings & their spouses/children
        if (childID !== memberID) deleteMember(childID, members, levels);
    });  
    parentMarr?.between?.forEach(parentID => deleteMemberUp(parentID, members, levels));
    removeFromMembers(member, members, levels);
}

function removeFromMembers (targetMember, members, levels) {
    members.delete(targetMember.memberID);  
    const parentMarr = getMarriage(levels, targetMember.parentMarriage);
    if (parentMarr) {
        parentMarr.children = parentMarr.children.filter(childID => childID !== targetMember.memberID);
    }  
}
 
// deletes empty marriages & levels
function deleteEmpty(members, levels) {  
    levels.map.forEach(level => {
        level.marriages.forEach(marriage => {  
            const marrIsEmpty = marriage.between.length < 2 && marriage.children.length === 0; 
            if (marrIsEmpty) levels.deleteMarriage(level.levelID, marriage.marriageID);   
        });  
    });

    // record number of members in each level
    const lvlMemberCounts = Array.from(members.map.values()).reduce((acc, member) => {
        acc[member.level] = (acc[member.level] || 0) + 1;
        return acc;
    }, {});  

    levels.map.forEach(level => {  
        const lvlMembers = lvlMemberCounts[level.levelID];    
        const lvlIsEmpty = (lvlMembers === 0 || lvlMembers === undefined) && level.marriages.size === 0;
        if (lvlIsEmpty) levels.delete(level.levelID);
    });
}


/* Utility Functions */   
export function getMarriage(levels, marriageID) {  
    if (marriageID > 0) {
        for (let lvl of levels.map.values()) {  
            const marriage = lvl.marriages.get(marriageID);  
            if (marriage !== undefined) return marriage;
        };
    }
    return null;
}

export function getSpouse(memberID, marriage, members) {
    if (!marriage || marriage.between.length !== 2) return null;  
    if (marriage.between[0] === memberID) {
        return members.get(marriage.between[1]);  
    } else if (marriage.between[1] === memberID) {
        return members.get(marriage.between[0]);
    }
    return null;
}

export function getSpouseIndex(memberID, marriage) { 
    return (marriage.between.length === 1 || marriage.between[0] === memberID) ? 0 : 1;
}

// returns true if target member is a `main` parent (direct ancestor of the main user)
function isMainParent(marriage, targetMemberID, members, levels) {
    if (!marriage) return false;  
    if (marriage.between.includes(targetMemberID)) return true;  
    for (let i = 0; i < marriage.between.length; i++) {
        const parent = members.get(marriage.between[i]);
        const parentMarr = getMarriage(levels, parent.parentMarriage);
        if (isMainParent(parentMarr, targetMemberID, members, levels)) return true;
    }
    return false;
}
 
function firstSpouseIsMain(marriage, members) {  
    if (marriage.between?.length > 0) {
        const firstSpouse = members.get(marriage.between[0]);
        return marriage.between.length === 2 && !firstSpouse.isAddOnSpouse;
    }
    return false;
}

export function hasGrandParents(marriage, members, levels) {
    let gparents = false;
    marriage?.between?.forEach(spouseID => {
        const spouse = members.get(spouseID); 
        if (spouse.parentMarriage) {
            gparents = getMarriage(levels, spouse.parentMarriage).between.length > 0; 
        }
    });  
    return gparents;
}

function getParentMarriage(child, levels) {
    // creates parent marriage/level if non-existent
    let parentLvl = levels.get(child.level-1);    
    if (!parentLvl) {  
        parentLvl = new Level({ levelID: child.level-1 });  
        levels.set(parentLvl.levelID, parentLvl);  
    } 
    let parentMarr = getMarriage(levels, child.parentMarriage);
    if (!parentMarr) {
        parentMarr = new Marriage({
            marriageID: levels.getNextMarriageID(),
            levelID: parentLvl.levelID,
            children: [child.memberID]
        });  
        levels.setMarriage(parentLvl.levelID, parentMarr.marriageID, parentMarr);  
        child.parentMarriage = parentMarr.marriageID;  
    }
    return parentMarr;
}