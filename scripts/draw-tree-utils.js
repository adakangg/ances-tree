import * as treeUtils from './tree-utils.js';

const primaryColor = "#6a5acd";
const contrastColor = "#fff";   
const NODE_RADIUS = 30; 
const NODE_TOP_CONNECTOR_LENGTH = 10; // vertical line connecting sibling nodes to horizontal sibling line
const LEVEL_HEIGHT = 150; // vertical distance between parent and child levels
const NODE_WIDTH = 140; // horizontal distance between nodes on same level
let members = [], levels = [], selectedTree = null;
let zoomFactor = d3.zoomIdentity.k;  
const minZoom = 0.5, maxZoom = 2;
let zoom = null;

// renders main tree showing user's entire family
let mainTree = { svg: d3.select("#main-tree-svg"), extension: "main" }; 

// renders tree showing only selected member's descendants in popup
let extendedTree = { svg: d3.select("#extended-tree-svg"), extension: "ext" };


// main tree consists of two trees:
//    upper tree where main user acts as root for ancestors
//    lower tree where main user acts as root for descendants
export function drawTree(membersData, levelsData, handleMemberClick, updateZoomProgress) { 
    members = membersData;
    levels = levelsData;          
    let rootMember = members.get(1);      
    let parentMarr = treeUtils.getMarriage(levels, rootMember.parentMarriage);  
    let upperTreeData = formatTreeHierarchy("upper", parentMarr);  
    let lowerTreeData = formatTreeHierarchy("lower", parentMarr);   
    let upperTree = setTreeLayout("upper", upperTreeData);  
    let lowerTree = setTreeLayout("lower", lowerTreeData);  
    setupMainTreeDOM(); 
    selectedTree = mainTree; 
    createNodes(upperTree, mainTree.upperNodes, "upper-tree-node", handleMemberClick);
    createNodes(lowerTree, mainTree.lowerNodes, "lower-tree-node", handleMemberClick);
    setZoom(mainTree, updateZoomProgress);  
    linkMainTree(upperTreeData, lowerTreeData); 
    linkSiblings(parentMarr);
    centerTree(mainTree);
}

export function drawExtendedTree(selectedMemberID) {
    let rootMember = members.get(selectedMemberID);
    setupExtTreeDOM(); 
    selectedTree = extendedTree; 
    let extTreeData = formatTreeHierarchy("lower", { children: [selectedMemberID] });  
    let extTree = setTreeLayout("lower", extTreeData); 
    createNodes(extTree, extendedTree.nodes, "extended-tree-node", null); 
    setZoom(extendedTree);  
    let marriage = treeUtils.getMarriage(levels, rootMember.marriage);
    linkSpouses(marriage);
    linkLowerTree(extTreeData); 
    drawLinks();
    centerTree(extendedTree); 
}

export function closeExtendedTree() { selectedTree = mainTree; }
 


/** Tree Layout Setup Functions */

// recursively sets each member's parents/siblings as their `children` in nested hierarchy
// used to construct upper levels of tree 
function getParentsHierarchy(memberID, spouseIndex) {
    let member = members.get(memberID);     
    let parents = [], parentSiblings = []; 
    let parentMarr = treeUtils.getMarriage(levels, member.parentMarriage);   
    if (parentMarr) { // add parents 
        for (let i = 0; i < parentMarr.between.length; i++) { 
            let parent = getParentsHierarchy(parentMarr.between[i], i);
            if (parent) parents.push(...parent);   
        };
        
        parentMarr.children.forEach((childID) => { // add parents siblings + their spouses 
            let sibling = members.get(childID); 
            if (sibling.memberID !== memberID) { 
                let siblingMarr = treeUtils.getMarriage(levels, sibling.marriage);
                let siblingChildren = [], spouse = null;
                if (siblingMarr) {  
                    siblingMarr.children.forEach((childID) => { 
                        let children = getChildrenHierarchy(childID);
                        if (children) siblingChildren.push(...children); 
                    })
                    spouse = treeUtils.getSpouse(sibling.memberID, siblingMarr, members); 
                };

                parentSiblings.push({ 
                    name: sibling.name, 
                    memberID: sibling.memberID,  
                    hiddenChildren: siblingChildren, // hide actual children to prevent overlap with lower levels 
                    children: [], // only get parents for sibling who is `main` parent 
                    childrenLevel: member.level-1,  
                    width: 60,  
                    image: sibling.image 
                }); 

                if (spouse) { 
                    // sibling spouses included in member's `children` to position them on the same level
                    parentSiblings.push({ 
                        name: spouse.name, 
                        memberID: spouse.memberID, 
                        hiddenChildren: [],
                        children: [], 
                        childrenLevel: member.level-1,  
                        width: 60, 
                        image: spouse.image 
                    });  
                };
            }  
        });
    };

    let fmtedParent = {
        name: member.name, 
        memberID: member.memberID, 
        children: parents, 
        hiddenChildren: [],
        childrenLevel: member.level-1, 
        width: 60,  
        image: member.image 
    };

    // place parents at innner-most position amongst siblings
    if (spouseIndex === 0) {
        return [...parentSiblings, fmtedParent];
    } else {
        return [fmtedParent, ...parentSiblings];
    } 
}

// recursively sets each member's children as their `children` in nested hierarchy
// used to construct lower levels of tree 
function getChildrenHierarchy(memberID) {  
    let member = members.get(memberID);    
    let marr = treeUtils.getMarriage(levels, member.marriage);  
    let children = [];   
    if (marr) { 
        marr.children.forEach((childID) => {
            let memberChildren = getChildrenHierarchy(childID);
            if (memberChildren) children.push(...memberChildren);  
        });
    }; 

    let fmtedChild = [{
        name: member.name,
        memberID: member.memberID, 
        children: children, 
        childrenLevel: member.level + 1, 
        isAddOnSpouse: false,
        width: 60, 
        image: member.image 
    }];

    if (marr) { // will always be add-on spouse in lower levels
        let spouse = treeUtils.getSpouse(memberID, marr, members);
        if (spouse) {
            fmtedChild.push({
                name: spouse.name,
                memberID: spouse.memberID, 
                children: [], 
                childrenLevel: member.level + 1, 
                isAddOnSpouse: true,
                width: 60, 
                image: spouse.image 
            });
        };
    };  
    return fmtedChild; 
}

// formats data for tree's levels into hierarchical structure required by d3 
function formatTreeHierarchy(treeType, parentMarriage) {
    let treeChildren = [], startLvl = 0;  
    if (parentMarriage) {
        if (treeType === "upper") {
            startLvl = -1;
            for (let i = 0; i < parentMarriage.between.length; i++) {
                let parents = getParentsHierarchy(parentMarriage.between[i], i); 
                if (parents) treeChildren.push(...parents);
            }
        } else if (treeType === "lower") {
            startLvl = 0;  
            parentMarriage.children.forEach((childID) => {
                let children = getChildrenHierarchy(childID);
                if (children) treeChildren.push(...children);
            })
        }
    }
    return { 
        name: "pseudo root",
        memberID: 0,
        childrenLevel: startLvl,
        children: treeChildren,
        image: null,
        width: 60
    };
}

// assign positions for each node + return tree's nodes in top-down order
function setTreeLayout(treeType, treeData) {
    const root = d3.hierarchy(treeData);
    const deepestLvl = d3.max(root.descendants(), d => d.depth); 
    const treeLayout = d3.tree()
        .nodeSize([NODE_WIDTH, LEVEL_HEIGHT])  
        .separation((a, b) => a.parent === b.parent  ? 1 : 2); 

    treeLayout(root); 
    if (treeType === "upper") { // flip upper tree upside down to place oldest generations at top
        root.descendants().forEach(d => d.y = deepestLvl * LEVEL_HEIGHT - d.y);
    }
    return root.descendants();
}
 
function setupMainTreeDOM() {  
    mainTree.svg.selectAll("*").remove();
    let tree = mainTree.svg.append("g").attr("id", "main-tree"); 
    let nodes = tree.append("g").attr("id", "main-tree-nodes");   
    mainTree = { 
        ...mainTree,
        tree: tree,
        nodes: nodes,
        upperNodes: nodes.append("g").attr("id", "upper-tree-nodes").attr("transform", (d) => `translate(0,0)`),
        lowerNodes: nodes.append("g").attr("id", "lower-tree-nodes").attr("transform", (d) => `translate(0,0)`),  
        parentChildLines: new Map(),
        siblingLines: new Map(),
        spouseLines: new Map(),
        topConnectorLines: new Map(),
        processedMarriages: [] // track marriages processed when linking tree to prevent duplicate spouse lines
    };
}

function setupExtTreeDOM() {
    extendedTree.svg.selectAll("*").remove();
    let tree = extendedTree.svg.append("g").attr("id", "extended-tree"); 
    let nodes = tree.append("g").attr("id", "extended-tree-nodes");  
    extendedTree = {
        ...extendedTree,
        tree: tree,
        nodes: nodes, 
        parentChildLines: new Map(),
        siblingLines: new Map(),
        spouseLines: new Map(),
        topConnectorLines: new Map(),
        processedMarriages: [] 
    };
}

function centerTree(containers) {   
    const treeBBox = document.getElementById(containers.tree._groups[0][0].id).getBBox();   
    const svgBox = document.getElementById(containers.svg._groups[0][0].id).getBoundingClientRect();    
    const centerX = (svgBox.width - treeBBox.width) / 2 - treeBBox.x;
    const centerY = (svgBox.height - treeBBox.height) / 2 - treeBBox.y; 
    containers.tree.attr("transform", `translate(${centerX}, ${centerY})`); 
}
 


/** Node Creation Functions */ 

function createNodes(treeData, nodesContainer, className, handleMemberClick) {   
    const nodes = nodesContainer
        .selectAll(`.${className}`)
        .data(treeData)
        .enter() 
        .append("g")
        .attr("id", d => `g-${selectedTree.extension}-${ d.data.memberID }`)
        .attr("class", className) 
        .attr("transform", (d) => `translate(${d.x},${d.y})`) 
        .style("display", (d) => d.data.memberID === 0 ? "none" : "default"); // hide pseudo root
        
    // add family member's picture + name label
    nodes.each(function (d) { 
        d3.select(this)
            .append("circle")
            .attr("id", `circle-${ selectedTree.extension }-${ d.data.memberID }`) 
            .attr("r", NODE_RADIUS)   
            .attr("fill", "none")
            .attr("stroke", contrastColor)
            .attr("stroke-width", 2);
 
        // split long names to prevent overlap with adjacent nodes
        const splitName = splitStringByCharLength(d.data.name, 10, d.data.hiddenChildren?.length > 0);    
        d3.select(this)
            .append("text")
            .attr("id", d => `text-${selectedTree.extension}-${ d.data.memberID }`) 
            .attr("transform", `translate(${0},${ NODE_RADIUS * 1.5 })`)
            .style("text-anchor", "middle")
            .selectAll("tspan")
            .data(splitName)
            .enter()
            .append("tspan")
            .text(d => d)
            .attr("fill", contrastColor)
            .attr("stroke", contrastColor)
            .attr("font-weight", "100")
            .attr("font-size", "13px") 
            .attr("letter-spacing", "0.7") 
            .attr("x", 0) 
            .attr("dy", (d, i) => splitName.length > 1 ? (i === 0 ? `0.15em` : "1em") : "0"); // shift only for split/multi-lines
 
        d3.select(this)
            .append("image")
            .attr("id", `image-${ selectedTree.extension }-${ d.data.memberID }`)
            .attr("href", d.data.image) 
            .attr("width", NODE_RADIUS*2)
            .attr("height", NODE_RADIUS*2)
            .attr("x", -NODE_RADIUS)  
            .attr("y", -NODE_RADIUS); 

        d3.select(this)
            .on("click", function(event, d) {    
                const memberNode = document.getElementById(`g-${ selectedTree.extension }-${ d.data.memberID }`);    
                const memberNodeRect = memberNode.getBoundingClientRect(); 
                handleMemberClick(d.data, memberNodeRect); 
            })
            .on("mouseover", function(event, d) { // highlights node   
                d3.select(this).select("circle").attr("stroke", primaryColor);
                d3.select(this).selectAll("text").attr("stroke", primaryColor);
                d3.select(this).selectAll("text").attr("fill", primaryColor);
            })
            .on("mouseleave", function() { // removes highlight 
                d3.select(this).select("circle").attr("stroke", contrastColor);
                d3.select(this).selectAll("text").attr("stroke", contrastColor);
                d3.select(this).selectAll("text").attr("fill", contrastColor);
            })
            .style("cursor", "pointer"); 
    }); 
}

// apply zoom/panning within tree container
function setZoom(tree, updateZoomProgress) { 
    function filter(event) {
        event.preventDefault();
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
    }; 

    zoom = d3.zoom() 
        .scaleExtent([minZoom, maxZoom])
        .filter(filter)
        .on("zoom", handleZoom);
 
    function handleZoom(event) { 
        const {transform} = event; 
        let zoomPercent = ((transform.k - minZoom) / (maxZoom - minZoom)) * 100;   
        updateZoomProgress(zoomPercent);  
        tree.nodes.attr("transform", transform);
        tree.svg.selectAll("line").attr("transform", transform);
    };  
    tree.svg.call(zoom);    
}

export function zoomIn() { 
    selectedTree.svg.transition()
        .duration(100)
        .call(zoom.scaleBy, 1.2); 
}

export function zoomOut() { 
    selectedTree.svg.transition()
        .duration(100)
        .call(zoom.scaleBy, 1/1.2); 
}

const charIsLetter = (char) => { return /[a-zA-Z]/.test(char) };

// separate string into characters of set length 
const splitStringByCharLength = (str, chunkLength, showEllipses) => { 
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkLength) {
        let chunk = str.substr(i, chunkLength);
        if (i + chunkLength < str.length && charIsLetter(str[i+chunkLength-1])) {
            const nextChar = str[i+chunkLength];
            if (charIsLetter(nextChar)) {
                chunk += "-";
            } else if (nextChar === " ") {
                i++;
            }
        }
        chunks.push(chunk);
    }
    if (showEllipses) chunks.push(". . .");
    return chunks;
}

 

/** Node Linking Functions */
 
// position links between members in upper tree
// lower level (children/siblings) positioned first -> parents adjusted to them
function linkUpperTree(level) {   
    if (level?.children.length > 0) {
        let lvl = levels.get(level.childrenLevel);  
        lvl.marriages.forEach((value) => {    
            if (!selectedTree.processedMarriages.includes(value.marriageID)) linkSpouses(value);    
        }); 

        let parentLvl = levels.get(level.childrenLevel-1);    
        if (parentLvl) {
            parentLvl.marriages.forEach((value) => {   
                if (!selectedTree.processedMarriages.includes(value.marriageID)) {
                    let parentMarr = value;
                    if (parentMarr.children.length > 1) { // connect siblings
                        let lines = createSiblingLine(parentMarr, false);   
                        if (parentMarr.between.length > 0) {
                            let parentChildLine = { 
                                x1: 0,
                                y1: 0,
                                x2: (lines.siblingLine.x1 + lines.siblingLine.x2) / 2,
                                y2: lines.siblingLine.y1 
                            };  
                            selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine);    
                        } 
                        selectedTree.siblingLines.set(parentMarr.marriageID, lines.siblingLine); 
                        selectedTree.topConnectorLines.set(parentMarr.marriageID, lines.topConnectorLines);  
                    } else if (parentMarr.children.length === 1) { 
                        let childNode = getElementBounds(parentMarr.children[0], "circle");    
                        if (parentMarr.between.length > 0) {
                            let parentChildLine = { 
                                x1: 0,
                                y1: 0,
                                x2: childNode.x + NODE_RADIUS,
                                y2:  childNode.y
                            };
                            selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine);    
                        }  
                    }
                }  
            });
            
        } 
        level.children.forEach(child => linkUpperTree(child));
    };
}

// position links between members in lower tree
// upper level (parents) positioned first -> children adjusted to them
function linkLowerTree(level) {     
    if (level?.children.length > 0) {  
        let parent = members.get(level.memberID);
        if (parent) {
            let parentMarr = treeUtils.getMarriage(levels, parent.marriage);    
            if (parentMarr) {  
                let parentsMidpoint = getMarriageMidpoint(parentMarr); 
                let parentChildLine = {
                    x1: parentsMidpoint.x,
                    y1: parentsMidpoint.y,
                    x2: 0,
                    y2: 0
                };    
                selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine); 
                linkSiblings(parentMarr);  
            }
        }  
        level.children.forEach(child => linkLowerTree(child));
    } 
}

// returns midoint between member(s) of a marriage
function getMarriageMidpoint(marriage) {   
    if (marriage) {
        if (marriage.between.length === 2) { 
            let spouseLine = selectedTree.spouseLines.get(marriage.marriageID);  
            return {
                x: (spouseLine.x1 + spouseLine.x2) / 2,
                y: spouseLine.y1
            }
        } else if (marriage.between.length === 1) { 
            let member = getElementBounds(marriage.between[0], "circle"); 
            let memberName = getElementBounds(marriage.between[0], "text");     
            return {
                x: member.x + NODE_RADIUS,
                y: memberName.y + memberName.height + 5
            } 
        }
    }
    return null; 
}

// create horizontal line linking siblings + vertical line connecting individual nodes to sibling line
function createSiblingLine(parentMarr, includeSpouse) {  
    let siblingLine = { x1: 0, y1: 0, x2: 0, y2: 0 };   
    let topConnectorLines = [];
    for (let i = 0; i < parentMarr.children.length; i++) {
        let child = members.get(parentMarr.children[i]);
        let childNode = getElementBounds(parentMarr.children[i], "circle");  
        let topConnectorLine = {
            x1: childNode.x + NODE_RADIUS,
            y1: childNode.y,
            x2: childNode.x + NODE_RADIUS,
            y2: childNode.y - NODE_TOP_CONNECTOR_LENGTH
        }; 
        topConnectorLines.push(topConnectorLine);
        if (i === 0) {
            siblingLine.x1 = topConnectorLine.x2;
            siblingLine.y1 = topConnectorLine.y2;
        }
        if (i === parentMarr.children.length - 1) {
            siblingLine.x2 = topConnectorLine.x2;
            siblingLine.y2 = topConnectorLine.y2;
        }   

        if (includeSpouse) {
            let childMarr = treeUtils.getMarriage(levels, child.marriage); 
            if (childMarr) {
                let spouse = treeUtils.getSpouse(child.memberID, childMarr, members);
                if (spouse?.isAddOnSpouse) { 
                    createSpouseLine(childMarr);  
                }
                if (childMarr.children.length > 0) {
                    let marrMidpoint = getMarriageMidpoint(childMarr);
                    let childParentChildLine = {
                        x1: marrMidpoint.x,
                        y1: marrMidpoint.y,
                        x2: 0,
                        y2: 0,
                    };
                    selectedTree.parentChildLines.set(childMarr.marriageID, childParentChildLine); 
                } 
            }
        }
    } 
    return {
        siblingLine: siblingLine,
        topConnectorLines: topConnectorLines
    }; 
}

// calculates distance to shift target value to match reference value
function calcShiftDistance(targetPoint, referencePoint) {
    let diff = Math.abs(referencePoint - targetPoint);
    if (targetPoint > referencePoint) diff *= -1;     
    return diff;
}

// connect + position child(ren) (& their spouses/children) for a given marriage
// set ending point for children in parent-child connecting line
function linkSiblings(parentMarr) {     
    let parentChildLine = selectedTree.parentChildLines.get(parentMarr.marriageID);   
    let shiftDistance = 0;
    if (parentMarr.children.length > 1) {  
        let lines = createSiblingLine(parentMarr, true);   
        if (parentChildLine) {
            // shift children + their spouses + lines if not centered under parents
            let siblingMidpointX = (lines.siblingLine.x1 + lines.siblingLine.x2) / 2; 
            if (siblingMidpointX !== parentChildLine.x1) { 
                shiftDistance = calcShiftDistance(siblingMidpointX, parentChildLine.x1); 
                parentMarr.children.forEach((childID) => {
                    shiftMember(childID, shiftDistance + NODE_RADIUS);
                })
                lines.siblingLine = {
                    x1: lines.siblingLine.x1 + shiftDistance,
                    y1: lines.siblingLine.y1,
                    x2: lines.siblingLine.x2 + shiftDistance,
                    y2: lines.siblingLine.y2, 
                };  
                lines.topConnectorLines = lines.topConnectorLines.map(line => {
                    return {
                        x1: line.x1 + shiftDistance,
                        y1: line.y1,
                        x2: line.x2 + shiftDistance,
                        y2: line.y2
                    }
                });   
            }   
            parentChildLine = {
                x1: parentChildLine.x1,
                y1: parentChildLine.y1,
                x2: parentChildLine.x1, 
                y2: lines.siblingLine.y2 
            }; 
            selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine); 
        }   
        selectedTree.topConnectorLines.set(parentMarr.marriageID, lines.topConnectorLines); 
        selectedTree.siblingLines.set(parentMarr.marriageID, lines.siblingLine);    
    } else if (parentMarr.children.length === 1) { 
        let child = members.get(parentMarr.children[0]); 
        let childNode = getElementBounds(parentMarr.children[0], "circle");     
        let childMarr = treeUtils.getMarriage(levels, child.marriage);  
        if (childMarr) { 
            // create spouse and start parent-child lines for this member
            let spouse = treeUtils.getSpouse(child.memberID, childMarr, members);
            if (spouse?.isAddOnSpouse) createSpouseLine(childMarr);  
            if (childMarr.children.length > 0) {
                let marrMidpoint = getMarriageMidpoint(childMarr); 
                let childParentChildLine = {
                    x1: marrMidpoint.x,
                    y1: marrMidpoint.y,
                    x2: 0,
                    y2: 0 
                };
                selectedTree.parentChildLines.set(childMarr.marriageID, childParentChildLine); 
            }; 
        }
        if (parentChildLine) {    
            let childMidpoint = childNode.x + NODE_RADIUS;  
            if (childMidpoint !== parentChildLine.x1) {     
                shiftDistance = calcShiftDistance(childMidpoint - NODE_RADIUS, parentChildLine.x1);
                shiftMember(parentMarr.children[0], shiftDistance);   
                childMidpoint = getElementBounds(parentMarr.children[0], "circle").x + NODE_RADIUS;
            };      
            
            parentChildLine = {
                x1: parentChildLine.x1,
                y1: parentChildLine.y1,
                x2: childMidpoint, 
                y2: childNode.y 
            };
            selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine); 
        } 
    }  
}

// connect + position parent(s) for a given marriage
// set starting point for their children in parent-child connecting line
function linkSpouses(marriage) { 
    if (marriage.between.length > 0) {
        let parentChildLine = selectedTree.parentChildLines.get(marriage.marriageID);   
        let shiftDistance = 0;
        if (marriage.between.length === 2) {  
            let spouseLine = createSpouseLine(marriage); 
            let spousesMidpointX = (spouseLine.x1 + spouseLine.x2) / 2;     
            if (parentChildLine) { 
                if (spousesMidpointX !== parentChildLine.x2) {       
                    // shift spouses + their siblings + lines if not centered above children  
                    shiftDistance = calcShiftDistance(spousesMidpointX, parentChildLine.x2);  
                    marriage.between.forEach((spouseID) => {
                        shiftMember(spouseID, shiftDistance + NODE_RADIUS);
                        shiftMemberSiblings(spouseID, shiftDistance + NODE_RADIUS); 
                    })
                    spouseLine =  { 
                        x1: spouseLine.x1 + shiftDistance,  
                        y1: spouseLine.y1,
                        x2: spouseLine.x2 + shiftDistance,
                        y2: spouseLine.y2 
                    }; 
                } 
                spousesMidpointX = (spouseLine.x1 + spouseLine.x2) / 2; 
                parentChildLine.x1 = spousesMidpointX;
                parentChildLine.y1 = spouseLine.y1;   
            }     
            selectedTree.spouseLines.set(marriage.marriageID, spouseLine);  
        } else if (marriage.between.length === 1) {
            if (parentChildLine) {
                let parentID = marriage.between[0];
                let parent = getElementBounds(parentID, "g");   
                let parentMidpointX = getMarriageMidpoint(marriage).x;  
                if (parentMidpointX !== parentChildLine.x2) {    
                    shiftDistance = calcShiftDistance(parentMidpointX, parentChildLine.x2);
                    shiftMember(parentID, shiftDistance + NODE_RADIUS);
                    shiftMemberSiblings(parentID, shiftDistance + NODE_RADIUS);  
                }  
                parentChildLine.x1 = parentMidpointX + shiftDistance;
                parentChildLine.y1 = parent.y + parent.height + 5;    
            } 
        }  
    } 
    selectedTree.processedMarriages.push(marriage.marriageID);
}
 
// create horizontal line linking spouses
function createSpouseLine(marriage) {   
    let leftSpouse = getElementBounds(marriage.between[0], "circle");
    let rightSpouse = getElementBounds(marriage.between[1], "circle"); 

    if (leftSpouse.x > rightSpouse.x) {
        let copy = {...leftSpouse};
        leftSpouse = rightSpouse;
        rightSpouse = copy;
    }
    let spouseLine = { 
        x1: leftSpouse.x + NODE_RADIUS*2,  
        y1: leftSpouse.y + NODE_RADIUS,
        x2: rightSpouse.x - 1,
        y2: leftSpouse.y + NODE_RADIUS 
    };  
    selectedTree.spouseLines.set(marriage.marriageID, spouseLine); 
    return spouseLine;
}

// shift member and their add-on spouses `x` position by specified distance 
function shiftMember(memberID, shiftDistance) {   
    let element = getElementBounds(memberID, "g");   
    let transformation = getElementTransformation(memberID, "g");    
    d3.select(`#g-${selectedTree.extension}-${memberID}`)
        .attr("transform", function () { 
            return `translate(${ element.x + shiftDistance }, ${ transformation.y })`;  
        });   
    let member = members.get(memberID);
    let marr = treeUtils.getMarriage(levels, member.marriage);
    if (marr) {
        let spouse = treeUtils.getSpouse(memberID, marr, members);
        if (spouse?.isAddOnSpouse) { 
            shiftMember(spouse.memberID, shiftDistance); 
            let spouseLine = selectedTree.spouseLines.get(marr.marriageID);   
            spouseLine.x1 = spouseLine.x1 + shiftDistance - NODE_RADIUS;
            spouseLine.x2 = spouseLine.x2 + shiftDistance - NODE_RADIUS;
        } 
    } 
}

// shift given member's siblings `x` position by specified distance
function shiftMemberSiblings(memberID, offset) {
    let member = members.get(memberID);
    let parentMarr = treeUtils.getMarriage(levels, member.parentMarriage);
    if (parentMarr?.children.length > 1) {  
        parentMarr.children.forEach((childID) => {
            if (childID !== member.memberID) shiftMember(childID, offset);  
        }); 
    } 
}

// position main user level (& siblings + spouses) to connect upper and lower tree
function positionConnectingLevel() {
    let mainUser = members.get(1); 
    let parentMarr = treeUtils.getMarriage(levels, mainUser.parentMarriage);  
    let parentMidpoint = getMarriageMidpoint(parentMarr);    
    let shiftDistance = 0;
    if (parentMidpoint) {
        let parentChildLine = {
            x1: parentMidpoint.x,
            y1: parentMidpoint.y,
            x2: 0,
            y2: 0
        }; 
        selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine); 
        let mainUserNode = getElementBounds(mainUser.memberID, "g");  
        if (mainUserNode.y <= parentMidpoint.y) { 
            shiftDistance = parentChildLine.y1 + LEVEL_HEIGHT/10; 
            d3.select(`#lower-tree-nodes`)
                .attr("transform", `translate(0, ${shiftDistance})`);  
        };
    };   
    linkSiblings(parentMarr); 
}
 
// create links betwen upper & lower level in `main` tree
function linkMainTree(upperTreeData, lowerTreeData) { 
    linkUpperTree(upperTreeData);  
    positionConnectingLevel();  
    linkLowerTree(lowerTreeData);
    drawLinks();
}

function drawLinks() {
    let nodeLines = [ 
        ...selectedTree.spouseLines.values(), 
        ...selectedTree.parentChildLines.values(), 
        ...selectedTree.siblingLines.values(), 
        ...[...selectedTree.topConnectorLines.values()].flat() 
    ];     
    selectedTree.tree
        .selectAll(".node-link")
        .data(nodeLines)
        .enter()
        .append("line")
        .attr("class", "node-link")
        .attr("x1", (d) => d.x1)
        .attr("y1", (d) => d.y1)
        .attr("x2", (d) => d.x2)
        .attr("y2", (d) => d.y2)
        .attr("stroke", contrastColor);  
}
 


/** Fetch Element Position Functions */
  
// returns x,y values for specified element's translation FIX explicitly send 'svg' to use
const getElementTransformation = (id, elementType) => { 
    const element = selectedTree.svg.select(`#${ elementType }-${selectedTree.extension}-${ id }`); 
    const transformAttr = element.attr("transform"); 
    const match = transformAttr.match(/translate\(([^,]+),([^,]+)\)/);
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

// returns specified element's bounds (adjusted for translations)
const getElementBounds = (id, elementType) => { 
    const element = document.getElementById(`${elementType}-${selectedTree.extension}-${id}`);  
    if (element) {
        const elementBBox = element.getBBox(); 
        const ctm = element.getCTM();
        const transformedX = ctm.e + elementBBox.x * ctm.a + elementBBox.y * ctm.c;
        const transformedY = ctm.f + elementBBox.x * ctm.b + elementBBox.y * ctm.d;
        return {
            x: transformedX, 
            y: transformedY, 
            height: elementBBox.height, 
            width: elementBBox.width
        } 
    } 
    return null;
}