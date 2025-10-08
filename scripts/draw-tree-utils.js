import * as treeUtils from "./tree-utils.js"; 

const NODE_RADIUS = 30;
const NODE_TOP_CONNECTOR_LENGTH = 15; // vertical line connecting sibling nodes to horizontal sibling line
const LEVEL_HEIGHT = 150; // vertical distance between parent & child levels
let rootParentMarriage = null, members = [], levels = [], selectedTree = null, mainTree = null;

// main tree consists of 2 trees connected
//  1. upper tree where main user is root for ancestors
//  2. lower tree where main user is root for descendants
export function drawMainTree(membersData, levelsData, handleMemberClick, updateZoomProgress) {
    members = membersData, levels = levelsData;  
    const rootMember = members.get(1);      
    rootParentMarriage = treeUtils.getMarriage(levels, rootMember.parentMarriage);  

    // format upper/lower trees into d3-compliant hierarchy
    const upperTreeData = formatTreeHierarchy("upper", rootParentMarriage);  
    const lowerTreeData = formatTreeHierarchy("lower", rootParentMarriage);  
    const upperTreeLayout = setTreeLayout("upper", upperTreeData);  
    const lowerTreeLayout = setTreeLayout("lower", lowerTreeData);  
    mainTree = setupMainTreeDOM();
    selectedTree = mainTree; 
    
    // create/position/link tree nodes 
    createNodes(upperTreeLayout, mainTree.upperNodes, "upper-tree-node", handleMemberClick);
    createNodes(lowerTreeLayout, mainTree.lowerNodes, "lower-tree-node", handleMemberClick);
    setTreeZoom(mainTree, "main", updateZoomProgress);  
    positionTree(upperTreeData, lowerTreeData); 
    centerTree(mainTree);
}

export function drawExtendedTree(selectedMemberID, updateZoomProgress) {
    // format tree into d3-compliant hierarchy
    const extTreeRootMember = members.get(selectedMemberID);
    const extendedTree = setupExtTreeDOM();
    const extTreeData = formatTreeHierarchy("lower", { children: [selectedMemberID] });  
    const extTree = setTreeLayout("lower", extTreeData);
    selectedTree = extendedTree;

    // create/position/link tree nodes 
    createNodes(extTree, extendedTree.nodes, "extended-tree-node");
    setTreeZoom(extendedTree, "extended", updateZoomProgress);  
    const marriage = treeUtils.getMarriage(levels, extTreeRootMember.marriage);
    linkSpouses(marriage);
    linkLowerTree(extTreeData); 
    drawLinks();
    centerTree(extendedTree);
}  

export function resetSelectedTree() { selectedTree = mainTree };


/** Tree Layout Setup Functions */
// recursively sets each member's parents as their `children` in nested hierarchy (for upper tree) 
function getParentsHierarchy(memberID, spouseIndex) {
    const member = members.get(memberID);    
    const parents = [], siblings = [];
    const parentMarr = treeUtils.getMarriage(levels, member.parentMarriage);   
    parentMarr?.between?.forEach((parentID, index) => {  
        const parent = getParentsHierarchy(parentID, index);
        if (parent) parents.push(...parent);  
    })

    // set member's siblings + their spouses/children on same level
    parentMarr?.children?.forEach(childID => { 
        const sibling = members.get(childID);
        if (sibling.memberID !== memberID) {
            const siblingMarr = treeUtils.getMarriage(levels, sibling.marriage);
            const siblingChildren = []; 
            siblingMarr?.children?.forEach(childID => {
                const children = getChildrenHierarchy(childID);
                if (children) siblingChildren.push(...children);
            })
            siblings.push({
                name: sibling.name,
                memberID: sibling.memberID,  
                hiddenChildren: siblingChildren, // hide actual children to prevent overlap with tree's lower levels
                children: [], // only get parents for sibling who is `main` parent (direct ancestor of root user)
                childrenLevel: member.level-1,  
                width: 60,  
                image: sibling.image
            });
            const spouse = treeUtils.getSpouse(sibling.memberID, siblingMarr, members); 
            if (spouse) {  // siblings' spouses included in member's `children` to position them on the same level
                siblings.push({
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

    const fmtedMember = {
        name: member.name,
        memberID: member.memberID,
        children: parents,
        hiddenChildren: [],
        childrenLevel: member.level-1,
        childrenMarriageID: member.parentMarriage,
        width: 60,  
        image: member.image
    }; 
    // place member at inner-most position amongst siblings
    return spouseIndex === 0 ? [...siblings, fmtedMember] : [fmtedMember, ...siblings];
}
 
// recursively sets each member's children as their `children` in nested hierarchy (for lower tree) 
function getChildrenHierarchy(memberID) {  
    const member = members.get(memberID);
    const marriage = treeUtils.getMarriage(levels, member.marriage);  
    const children = [];   
    marriage?.children?.forEach(childID => {
        const memberChildren = getChildrenHierarchy(childID);
        if (memberChildren) children.push(...memberChildren);  
    }); 

    const fmtedChildren = [{
        name: member.name,
        memberID: member.memberID,
        children: children,
        childrenLevel: member.level + 1, 
        isAddOnSpouse: false,
        width: 60,
        image: member.image
    }];
    if (marriage) { // will always be add-on spouse in lower levels
        const spouse = treeUtils.getSpouse(memberID, marriage, members);
        if (spouse) {
            fmtedChildren.push({
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
    return fmtedChildren;
}

// formats tree data into structure required by d3
function formatTreeHierarchy(treeType, parentMarriage) {
    const treeChildren = []; 
    if (parentMarriage) {
        if (treeType === "upper") { // format upper tree levels (root user's ancestors)
            parentMarriage.between.forEach((parentID, index) => {
                const parents = getParentsHierarchy(parentID, index);
                if (parents) treeChildren.push(...parents);
            });
        } else if (treeType === "lower") { // format upper tree levels (root user's descendants)
            parentMarriage.children.forEach(childID => {
                const children = getChildrenHierarchy(childID);
                if (children) treeChildren.push(...children);
            })
        }
    }
    return {
        name: "pseudo root",
        memberID: 0,
        childrenLevel: treeType === "upper" ? -1 : 0,
        children: treeChildren,
        image: null,
        width: 60
    };
}

// assign node positions + return tree's nodes in top-down order
function setTreeLayout(treeType, treeData) {
    const NODE_WIDTH = 140; // horizontal distance between nodes on same level
    const root = d3.hierarchy(treeData);
    const deepestLvl = d3.max(root.descendants(), d => d.depth);
    const treeLayout = d3.tree().nodeSize([NODE_WIDTH, LEVEL_HEIGHT]);  
    treeLayout(root);
    if (treeType === "upper") { // flip upper tree upside down to place oldest generations at top
        root.descendants().forEach(d => d.y = deepestLvl * LEVEL_HEIGHT - d.y);
    }
    return root.descendants();
}

// default/main tree shows user's entire family
function setupMainTreeDOM() { 
    d3.select("#main-tree-svg").selectAll("*").remove();
    const tree = d3.select("#main-tree-svg").append("g").attr("id", "main-tree");
    const nodes = tree.append("g").attr("id", "main-tree-nodes");  
    return { 
        svg: d3.select("#main-tree-svg"),
        extension: "main",
        tree: tree,
        nodes: nodes,
        upperNodes: nodes.append("g").attr("id", "upper-tree-nodes").attr("transform", () => "translate(0,0)"),
        lowerNodes: nodes.append("g").attr("id", "lower-tree-nodes").attr("transform", () => "translate(0,0)"),  
        parentChildLines: new Map(),
        siblingLines: new Map(),
        spouseLines: new Map(),
        topConnectorLines: new Map()
    }; 
}
  
// extended tree shows selected member's hidden children in dialog
function setupExtTreeDOM() { 
    d3.select("#extended-tree-svg").selectAll("*").remove();
    const tree = d3.select("#extended-tree-svg").append("g").attr("id", "extended-tree");
    const nodes = tree.append("g").attr("id", "extended-tree-nodes");  
    return {
        svg: d3.select("#extended-tree-svg"),
        extension: "extended",
        tree: tree,
        nodes: nodes,
        parentChildLines: new Map(),
        siblingLines: new Map(),
        spouseLines: new Map(),
        topConnectorLines: new Map()
    };
}

function centerTree(containers) {  
    const treeBBox = document.getElementById(containers.tree._groups[0][0].id).getBBox();  
    const svgBox = document.getElementById(containers.svg._groups[0][0].id).getBoundingClientRect();    
    const centerX = (svgBox.width - treeBBox.width)/2 - treeBBox.x;
    const centerY = (svgBox.height - treeBBox.height)/2 - treeBBox.y;
    containers.tree.attr("transform", `translate(${centerX}, ${centerY})`);
} 
  
function setTreeZoom(tree, treeType, updateZoomProgress) {
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2; 
    function filter(event) {
        event.preventDefault();
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
    };  
    const zoom = d3.zoom()
        .scaleExtent([MIN_ZOOM, MAX_ZOOM])
        .filter(filter)
        .on("zoom", handleZoom);
 
    function handleZoom(event) { // apply zoom transformation to nodes/lines
        const { transform } = event;   
        const zoomPercent = ((transform.k - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;  
        updateZoomProgress(zoomPercent, treeType);      
        tree.nodes.attr("transform", transform);
        tree.svg.selectAll("line").attr("transform", transform);
    };  
    tree.svg.call(zoom);    
}

export function zoomIn() { selectedTree.svg.transition().duration(100).call(zoom.scaleBy, 1.2) }

export function zoomOut() { selectedTree.svg.transition().duration(100).call(zoom.scaleBy, 1/1.2) }


/** Node/Link Creation Functions */  
function createNodes(treeData, nodesContainer, className, handleMemberClick) {   
    const nodes = nodesContainer
        .selectAll(`.${className}`)
        .data(treeData)
        .enter()
        .append("g")
        .attr("id", d => `g-${selectedTree.extension}-${d.data.memberID}`)
        .attr("class", className)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .style("display", d => d.data.memberID === 0 ? "none" : "default"); // hide pseudo root

    nodes.each(function (d) { // add member's picture + name 
        const usesDefaultImg = typeof d.data.image === "string" && d.data.image.startsWith("assets/");
        d3.select(this)
            .append("circle")
            .attr("id", `circle-${selectedTree.extension}-${d.data.memberID}`)
            .attr("r", NODE_RADIUS)  
            .attr("fill", "none")
            .attr("stroke", usesDefaultImg ? "#fff" : "none")
            .attr("stroke-width", 2);
 
        // split long names to prevent overlap with adjacent nodes
        const splitName = splitStringByCharLength(d.data.name, 10, d.data.hiddenChildren?.length > 0);    
        d3.select(this)
            .append("text")
            .attr("id", d => `text-${selectedTree.extension}-${d.data.memberID}`)
            .attr("transform", `translate(${0},${NODE_RADIUS * 1.5})`)
            .style("text-anchor", "middle")
            .selectAll("tspan")
            .data(splitName)
            .enter()
            .append("tspan")
            .text(d => d)
            .attr("fill", "#fff")
            .attr("stroke", "#fff")
            .attr("font-weight", "100")
            .attr("font-size", "13px")
            .attr("letter-spacing", "0.7")
            .attr("x", 0)
            .attr("dy", (d, i) => splitName.length > 1 ? (i === 0 ? `0.15em` : "1em") : "0"); // shift only for split/multi-lines

        d3.select(this)
            .append("image")
            .attr("id", `image-${selectedTree.extension}-${d.data.memberID}`)
            .attr("href", d.data.image)
            .attr("width", NODE_RADIUS*2)
            .attr("height", NODE_RADIUS*2)
            .attr("x", -NODE_RADIUS)  
            .attr("y", -NODE_RADIUS)
            .attr("preserveAspectRatio", "xMidYMid slice");

        if (handleMemberClick) {
            d3.select(this)
            .on("click", function(event, d) {     
                const memberNode = document.getElementById(`g-${selectedTree.extension}-${d.data.memberID}`);    
                const memberNodeRect = memberNode.getBoundingClientRect();
                handleMemberClick(d.data, memberNodeRect);
            })
            .style("cursor", "pointer");
        }

        if (usesDefaultImg) {
            const PRIMARY_COLOR = "#91D378";
            d3.select(this)
                .on("mouseover", function() { // highlights node  
                    d3.select(this).select("circle").attr("stroke", PRIMARY_COLOR);
                    d3.select(this).selectAll("text").attr("stroke", PRIMARY_COLOR);
                    d3.select(this).selectAll("text").attr("fill", PRIMARY_COLOR);
                })
                .on("mouseleave", function() { // removes highlight
                    d3.select(this).select("circle").attr("stroke", "#fff");
                    d3.select(this).selectAll("text").attr("stroke", "#fff");
                    d3.select(this).selectAll("text").attr("fill", "#fff");
                });
        }
    });
}

function drawLinks() {
    const nodeLines = [
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
        .attr("x1", d => d.x1)
        .attr("y1", d => d.y1)
        .attr("x2", d => d.x2)
        .attr("y2", d => d.y2)
        .attr("stroke", "#fff");  
} 


/** Main Tree Positioning/Linking Functions */
// shift/create links between members + connect upper & lower tree
function positionTree(upperTreeData, lowerTreeData) {  
    linkUpperTree(upperTreeData); 
    positionLowerTree(rootParentMarriage);
    linkLowerTree(lowerTreeData);
    levels.map.forEach(level => {
        level.marriages.forEach(marriage => {  
            if (marriage.between.length > 1) linkSpouses(marriage);   
        });  
    });  
    drawLinks();
} 

// connect siblings + center parents above children in upper tree levels
function linkUpperTree(upperTreeData, shiftBy = 0) {
    upperTreeData.children.forEach(child => {  
        if (shiftBy) shiftMember(child.memberID, shiftBy); // center parents above children 
        if (child.childrenMarriageID) {
            const parentMarr = treeUtils.getMarriage(levels, child.childrenMarriageID);
            if (parentMarr) { 
                const lines = linkSiblings(parentMarr); // create line connecting siblings
                if (parentMarr.children.length > 1) {
                    selectedTree.siblingLines.set(parentMarr.marriageID, lines.siblingLine);
                    selectedTree.topConnectorLines.set(parentMarr.marriageID, lines.topConnectorLines);
                } 
                const siblingMidpointX = (lines.siblingLine.x1 + lines.siblingLine.x2) / 2; 
                const marriageMidpoint = getSpouseMidpoint(parentMarr);
                if (marriageMidpoint && parentMarr.between.length > 0) { // create line connecting parent + children
                    const parentChildLine = {
                        x1: siblingMidpointX,
                        y1: marriageMidpoint.y,
                        x2: siblingMidpointX,
                        y2: lines.siblingLine.y1
                    };  
                    selectedTree.parentChildLines.set(parentMarr.marriageID, parentChildLine);   
                }    
                linkUpperTree(child, siblingMidpointX-marriageMidpoint?.x ?? 0);
            }
        }
    });
}
 
// connect siblings + center children below parents in lower tree levels
function linkLowerTree(lowerTreeData) {  
    lowerTreeData.children.forEach(child => { 
        const childMember = members.get(child.memberID);
        if (childMember.marriage && !childMember.isAddOnSpouse) { 
            const marriage = treeUtils.getMarriage(levels, childMember.marriage);
            if (marriage.children.length) { 
                const marriageMidpoint = getSpouseMidpoint(marriage); 
                const siblingMidpoint = getSiblingMidpoint(marriage);  
                let shift = siblingMidpoint.x - marriageMidpoint.x;
                if (siblingMidpoint.x < marriageMidpoint.x) shift *= -1;  
                const parentChildLine = { // create line connecting parent + children
                    x1: marriageMidpoint.x,
                    y1: marriageMidpoint.y,
                    x2: marriageMidpoint.x,
                    y2: siblingMidpoint.y
                };  
                selectedTree.parentChildLines.set(marriage.marriageID, parentChildLine);   
                marriage.children.forEach(childID => { 
                    if (shift) shiftMember(childID, shift); // center children under parents
                });
                if (marriage.children.length > 1) linkSiblings(marriage);
            }
        }  
        linkLowerTree(child);
    });   
}

// center lower tree (main user + siblings + descendants) directly under main user's parents 
function positionLowerTree() {  
    if (rootParentMarriage && rootParentMarriage.children.length > 0) {
        const marriageMidpoint = getSpouseMidpoint(rootParentMarriage);    
        const siblingMidpoint = getSiblingMidpoint(rootParentMarriage);   
        const shiftDistance = marriageMidpoint ? marriageMidpoint?.x - siblingMidpoint.x : 0;   
        const treeDistance = treeUtils.hasGrandParents(rootParentMarriage, members, levels) ? LEVEL_HEIGHT : LEVEL_HEIGHT/12; 
        d3.select(`#lower-tree-nodes`).attr("transform", `translate(${shiftDistance}, ${treeDistance})`);
        if (rootParentMarriage.children.length > 1) linkSiblings(rootParentMarriage);      
        if (rootParentMarriage.between.length > 0 ) { 
            const parentChildLine = { 
                x1: marriageMidpoint.x,
                y1: marriageMidpoint.y,
                x2: marriageMidpoint.x,
                y2: siblingMidpoint.y + treeDistance 
            };  
            selectedTree.parentChildLines.set(rootParentMarriage.marriageID, parentChildLine);    
        }
    }
}


/** Positioning Utility Functions */ 
function getElementTransformation(id, elementType) {
    const element = selectedTree.svg.select(`#${elementType}-${selectedTree.extension}-${id}`);
    const transformAttr = element.attr("transform");
    const match = transformAttr.match(/translate\(([^,]+),([^,]+)\)/);
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}
 
function getElementBounds (id, elementType) { //adjust element bounds for translations
    const element = document.getElementById(`${elementType}-${selectedTree.extension}-${id}`);  
    if (!element) return null; 
    const elementBBox = element.getBBox();
    const ctm = element.getCTM();
    const transformedX = ctm.e + elementBBox.x * ctm.a + elementBBox.y * ctm.c;
    const transformedY = ctm.f + elementBBox.x * ctm.b + elementBBox.y * ctm.d;
    return {
        x: transformedX,
        y: transformedY,
        height: elementBBox.height,
        width: elementBBox.width
    };
}
 
function shiftMember(memberID, shiftX, shiftY = 0) {   
    const transformation = getElementTransformation(memberID, "g");     
    d3.select(`#g-${selectedTree.extension}-${memberID}`)
        .attr("transform", () => `translate(${transformation.x + shiftX}, ${transformation.y + shiftY})`);      
    const member = members.get(memberID); 
    const marriage = treeUtils.getMarriage(levels, member.marriage);
    if (marriage) { // also shift add-on spouse
        const spouse = treeUtils.getSpouse(memberID, marriage, members);
        if (spouse?.isAddOnSpouse) shiftMember(spouse.memberID, shiftX, shiftY);  
    }
}
 
function calcSpouseLine(marriage) {   
    let leftSpouse = getElementBounds(marriage.between[0], "circle");
    let rightSpouse = getElementBounds(marriage.between[1], "circle");  
    if (leftSpouse.x > rightSpouse.x) {
        const copy = {...leftSpouse};
        leftSpouse = rightSpouse;
        rightSpouse = copy;
    }
    return { // horizontal line connecting spouses
        x1: leftSpouse.x + NODE_RADIUS*2,  
        y1: leftSpouse.y + NODE_RADIUS,
        x2: rightSpouse.x - 1,
        y2: leftSpouse.y + NODE_RADIUS
    };    
}

function linkSpouses(marriage) {  
    const spouseLine = calcSpouseLine(marriage);  
    selectedTree.spouseLines.set(marriage.marriageID, spouseLine);   
} 
 
function calcSiblingLine(parentMarr) {  
    const siblingLine = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }; // horizontal line connecting siblings
    const topConnectorLines = []; // vertical lines connecting siblings to siblingLine
    parentMarr.children.forEach(childID => { 
        const childNode = getElementBounds(childID, "circle");   
        const topConnectorLine = { 
            x1: childNode.x + NODE_RADIUS,
            y1: childNode.y,
            x2: childNode.x + NODE_RADIUS,
            y2: childNode.y - NODE_TOP_CONNECTOR_LENGTH
        };
        topConnectorLines.push(topConnectorLine);  
        if (topConnectorLine.x2 < siblingLine.x1) {
            siblingLine.x1 = topConnectorLine.x2;
            siblingLine.y1 = topConnectorLine.y2;
        }
        if (topConnectorLine.x2 > siblingLine.x2) {
            siblingLine.x2 = topConnectorLine.x2;
            siblingLine.y2 = topConnectorLine.y2;
        }  
    });  
    return { siblingLine: siblingLine, topConnectorLines: topConnectorLines };
} 

function linkSiblings(marriage) {  
    const lines = calcSiblingLine(marriage);  
    selectedTree.siblingLines.set(marriage.marriageID, lines.siblingLine);
    selectedTree.topConnectorLines.set(marriage.marriageID, lines.topConnectorLines);  
    return lines;
} 

function getSpouseMidpoint(marriage) {   
    if (!marriage || marriage.between.length === 0) return null; 
    if (marriage.between.length === 2) {
        const spouse1 = getElementBounds(marriage.between[0], "circle");
        const spouse2 = getElementBounds(marriage.between[1], "circle");  
        return { // midpoint of horizontal spouse line
            x: ((spouse1.x + NODE_RADIUS*2) + (spouse2.x - 1)) / 2,
            y: spouse1.y + NODE_RADIUS
        };
    } else if (marriage.between.length === 1) { 
        const spouse = getElementBounds(marriage.between[0], "circle");
        const spouseName = getElementBounds(marriage.between[0], "text");  
        return { // positioned under member's name
            x: spouse.x + NODE_RADIUS,
            y: spouseName.y + spouseName.height + 5
        };
    } 
}  

 function getSiblingMidpoint(parentMarr) {  
    if (!parentMarr)  return null;
    const childXPos = [];
    let childYPos = 0;
    parentMarr.children.forEach((childID, index) => {
        const child = getElementBounds(childID, "circle"); 
        childXPos.push(child.x + NODE_RADIUS);
        if (index === 0) childYPos = child.y;
    })  
    return { // single child = positioned top of member node | children = midpoint of horizontal sibling line
        x:  ((d3.min(childXPos) + d3.max(childXPos)) / 2), 
        y: parentMarr.children.length > 1 ? childYPos - NODE_TOP_CONNECTOR_LENGTH : childYPos 
    };  
}  
 

/** String Utility Functions */
function charIsLetter(char) { return /[a-zA-Z]/.test(char) };
 
function splitStringByCharLength(str, chunkLength, showEllipses) {
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