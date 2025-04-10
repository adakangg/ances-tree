import { Level } from "../classes/Level.js";
import { Marriage } from "../classes/Marriage.js";
import { Member } from "../classes/Member.js"; 

/** Defines functions used to create relations & position family tree members */


/* Add Member Functions */

// create + add parent to existing child member
export function addParent(newParent, childID, members, levels) {    
    let child = members.get(childID);   
    if (child.isAddOnSpouse) throw new Error("Cannot add parents to this member"); 
    let parentMarr = getParentMarriage(child, levels);
    if (parentMarr.between.length === 2) throw new Error("Cannot add another parent");
    
    let isAddOnSpouse = child.level-1 >= 0 && firstSpouseIsMain(parentMarr, members); 
    let parent = new Member({ 
        memberID: members.getNextID(), 
        level: child.level-1, 
        marriage: parentMarr.marriageID,
        isAddOnSpouse: isAddOnSpouse, 
        ...newParent 
    });   
    parentMarr.between.push(parent.memberID);
    members.set(parent.memberID, parent);  
}

// create + add child to existing parent member 
export function addChild(newChild, parentID, members, levels) { 
    let parent = members.get(parentID);     
    let childLvl = levels.get(parent.level+1);  
    if (!childLvl) {  
        childLvl = new Level({ levelID: parent.level+1 });   
        levels.set(childLvl.levelID, childLvl);  
    } 

    let parentMarr = getMarriage(levels, parent.marriage); 
    if (!parentMarr) {   
        let parentLvl = levels.get(parent.level); 
        parentMarr = new Marriage({ 
            marriageID: levels.getNextMarriageID(), 
            levelID: parent.level, 
            between: [parentID] 
        });  
        parent.marriage = parentMarr.marriageID;
        levels.setMarriage(parentLvl.levelID, parentMarr.marriageID, parentMarr); 
    }  

    let child = new Member({ 
        memberID: members.getNextID(), 
        level: childLvl.levelID, 
        parentMarriage: parent.marriage,  
        ...newChild 
    });
    members.set(child.memberID, child);  
    parentMarr.children.push(child.memberID);
}

// create + add sibling to existing member
export function addSibling(newSiblingData, oldSiblingID, members, levels) {
    let oldSibling = members.get(oldSiblingID);
    if (oldSibling.isAddOnSpouse) throw new Error("Cannot add siblings to this member"); 

    let parentMarr = getParentMarriage(oldSibling, levels);
    let newSibling = new Member({ 
        memberID: members.getNextID(), 
        level: oldSibling.level,
        parentMarriage: parentMarr.marriageID,
        ...newSiblingData 
    }); 
    members.set(newSibling.memberID, newSibling);   
    parentMarr.children.push(newSibling.memberID);
}

// returns child's parent marriage (creates parent marriage/level if non-existent)
function getParentMarriage(child, levels) {
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

// create + add spouse to existing member 
export function addSpouse(newSpouseData, oldSpouseID, members, levels) { 
    let oldSpouse = members.get(oldSpouseID);
    let marriage = getMarriage(levels, oldSpouse.marriage);   
    if (oldSpouse.isAddOnSpouse || marriage?.between.length === 2) {  
        throw new Error("Cannot add spouse to this member");
    };

    let spouseLvl = levels.get(oldSpouse.level);
    if (!marriage) {
        marriage = new Marriage({
            marriageID: levels.getNextMarriageID(), 
            levelID: oldSpouse.level, 
            between: [oldSpouseID] 
        }); 
        oldSpouse.marriage = marriage.marriageID;    
        levels.setMarriage(spouseLvl.levelID, marriage.marriageID, marriage); 
    }

    let newSpouse = new Member({ 
        memberID: members.getNextID(), 
        level: oldSpouse.level,
        marriage: oldSpouse.marriage,
        ...newSpouseData 
    }); 
  
    const user = members.get(1);
    const parentMarr = getMarriage(levels, user.parentMarriage);
    isMainParent(parentMarr, oldSpouseID, members, levels);
    if (oldSpouse.level >= 0 || !isMainParent(parentMarr, oldSpouseID, members, levels)) {
        newSpouse.isAddOnSpouse = true;
    }

    marriage.between.push(newSpouse.memberID);
    members.set(newSpouse.memberID, newSpouse);     
}
 


/* Order/Position Member Functions */ 

// position members in upper levels of tree
export function positionMembers(members, levels) {   
    const mainUser = members.get(1);  
    const marriage = getMarriage(levels, mainUser.marriage); 
    positionMainParents(marriage, members, levels); 
}

// position parents for a given marriage at far-most end amongst their siblings
// used to prevent overlap between `main` parents who can each have siblings 
function positionMainParents(marriage, members, levels) {    
    if (marriage?.between.length === 2) { 
        for (let i = 0; i < 2; i++) {
            let spouse = members.get(marriage.between[i]);
            let parentMarr = getMarriage(levels, spouse.parentMarriage); 
            if (parentMarr) { 
                // left parent = positioned last/right-most amongst siblings
                // right parent = positioned first/left-most amongst siblings
                let spouseIndex = getElementIndex(spouse.memberID, parentMarr.children);
                let switchIndex = i === 0 ? parentMarr.children.length-1 : 0;
                let switchSiblingID = parentMarr.children[switchIndex];
                parentMarr.children[switchIndex] = spouse.memberID;
                parentMarr.children[spouseIndex] = switchSiblingID; 
                positionMainParents(parentMarr, members, levels);
            }
        }
    } 
}



/* General Utility Functions */ 

function getElementIndex(elementID, elements) {
    for (let i = 0; i < elements.length; i++) {
        if (elements[i] === elementID) return i;
    }
    return -1;
}

export function getMarriage(levels, marriageID) {   
    if (marriageID > 0) {
        for (let lvl of levels.map.values()) {  
            let marriage = lvl.marriages.get(marriageID);   
            if (marriage !== undefined) return marriage;
        };
    }
    return null;
}

// given memberID, returns that member's spouse, otherwise returns null
export function getSpouse(memberID, marriage, members) { 
    if (marriage.between.length !== 2) return null;  
    if (marriage.between[0] === memberID) {
        return members.get(marriage.between[1]);  
    } else if (marriage.between[1] === memberID) {
        return members.get(marriage.between[0]);
    }
    return null; 
}

export function getSpouseIndex(memberID, marriage) {
    if (marriage.between.length == 1) return 0;
    return marriage.between[0] === memberID ? 0 : 1; 
}

// returns true if target member is a `main` parent (direct ancestor of the main user)
function isMainParent(marriage, targetMemberID, members, levels) { 
    if (!marriage) return false;  
    if (marriage.between.includes(targetMemberID)) return true;  
    for (let i = 0; i < marriage.between.length; i++) {
        let parent = members.get(marriage.between[i]);
        let parentMarr = getMarriage(levels, parent.parentMarriage); 
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



/** Delete Member Functions */

// deletes given member & their relevant family members
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

// deletes given member & their descendants (add-on spouses/children)
function deleteMemberDown(memberID, members, levels) {
    const member = members.get(memberID);    
    const marr = getMarriage(levels, member.marriage);
    if (marr) {
        const spouse = getSpouse(memberID, marr, members);
        if (member.isAddOnSpouse) {
            // has children -> delete only member
            // no children -> reset remaining `main` spouse's marriage 
            if (marr.children.length === 0) {   
                spouse.marriage = 0;    
            } else {
                marr.between = [spouse.memberID];
            }
        } else {
            // also delete member's spouse/children
            if (marr.children.length > 0) { 
                marr.children.forEach((childID) => deleteMemberDown(childID, members, levels));
            }  
            if (spouse) removeFromMembers(spouse, members, levels); 
            marr.between = [];
        }
    }
    removeFromMembers(member, members, levels);
}

// deletes given member & their ancestors (add-on spouses/siblings/parents) 
function deleteMemberUp(memberID, members, levels) { 
    const member = members.get(memberID); 
    const marr = getMarriage(levels, member.marriage); 
    if (marr) {
        marr.between = marr.between.filter((spouseID) => spouseID !== memberID);
        const spouse = getSpouse(memberID, marr, members);
        if (spouse?.isAddOnSpouse) {
            deleteMemberDown(spouse.memberID, members, levels);
        }
    };

    const parentMarr = getMarriage(levels, member.parentMarriage);   
    if (parentMarr) {
        //delete member's siblings & their spouses/children 
        parentMarr.children.forEach((childID) => {
            if (childID !== memberID) deleteMember(childID, members, levels); 
        }); 

        //delete member's parents
        parentMarr.between.forEach((parentID) => { 
            deleteMemberUp(parentID, members, levels)
        }); 
    }   
    removeFromMembers(member, members, levels);
}

function removeFromMembers (targetMember, members, levels) { 
    members.delete(targetMember.memberID);  
    const parentMarr = getMarriage(levels, targetMember.parentMarriage);
    if (parentMarr) {
        parentMarr.children = parentMarr.children.filter((childID) => childID !== targetMember.memberID); 
    }  
}
 
// deletes empty marriages & levels
function deleteEmpty(members, levels) {   
    levels.map.forEach((value) => { 
        let lvl = value;  
        lvl.marriages.forEach((value) => { 
            let marr = value;
            const marrIsEmpty = marr.between.length < 2 && marr.children.length === 0;
            if (marrIsEmpty) levels.deleteMarriage(lvl.levelID, marr.marriageID);  
        });   
    });

    // record number of members in each level
    const lvlMemberCounts = Array.from(members.map.values()).reduce((acc, member) => {
        acc[member.level] = (acc[member.level] || 0) + 1;
        return acc;
    }, {});   

    levels.map.forEach((value) => {  
        let lvl = value;
        const lvlMembers = lvlMemberCounts[lvl.levelID];     
        const lvlIsEmpty = (lvlMembers === 0 || lvlMembers === undefined) && lvl.marriages.size === 0; 
        if (lvlIsEmpty) levels.delete(lvl.levelID); 
    }); 
}