import * as drawTree from './scripts/draw-tree-utils.js';
import * as treeUtils from './scripts/tree-utils.js';  
import { LevelMap, MemberMap } from './classes/UniqueIDMap.js';
import { Level } from './classes/Level.js';
import { Marriage } from './classes/Marriage.js';
import { Member } from './classes/Member.js'; 

const defaultImgsCount = 5; 
let selectedFormImgPath = "assets/avatar1.png"; // image selected as form member's profile picture
let selectedMember = null, selectMode = null, openDialogType = null, levels = null, members = null;  
const formDialog = document.getElementById("member-form-dialog");
const memberForm = document.getElementById("member-form"); 
const extendedTreeDialog = document.getElementById("extended-tree-dialog");
const warningDialog = document.getElementById("warning-dialog");
const selectedFormImg = document.getElementById("form-selected-img");
const nameInput = document.getElementById("name");   
let headerSubtitle = document.getElementById("subtitle-text");

window.onload = function () {  
    setDefaultData();
    setupMemberModeBtns();
    setupFormDialog();     
    setupExtendedTreeDialog();
    setupWarningDialog();
    handleEscPress();
    buildTree();   
    document.getElementById("zoom-in-btn").onclick = () => drawTree.zoomIn(); 
    document.getElementById("zoom-out-btn").onclick = () => drawTree.zoomOut();  
}

// callback to update zoom progress bar when tree area is zoomed in/out of
function updateZoomProgress(zoomedAmt) { 
    let progressBar = document.getElementById("zoom-progress-value");
    progressBar.style.width = `${zoomedAmt}%`; 
}

function setDefaultData() {
    levels = new LevelMap({ 
        map: new Map([
            [
                -1, 
                new Level({ 
                    levelID: -1,
                    marriages: new Map([
                        [1, new Marriage({ marriageID: 1, levelID: -1, children: [1], between: [] })] 
                    ]) 
                })
            ],
            [0, new Level({ levelID: 0 })],
        ]), 
        usedIDs: new Set([1]) 
    }); 
    
    members = new MemberMap({
        map: new Map([ 
            [1, new Member({ memberID: 1, name: "me", level: 0, parentMarriage: 1, marriage: 0 })]  
        ]), 
        usedIDs: new Set([1]) 
    });
}

function handleEscPress() {
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            if (openDialogType === "form") { 
                closeForm();  
            } else if (openDialogType === "tree") { 
                closeExtendedTree();
            } else if (selectMode !== null) {
                exitSelectMemberMode();
            }
        }
    }); 
}

function showElement(element) {
    let classes = element.classList;  
    if (classes.contains("hidden")) classes.remove("hidden"); 
}

function hideElement(element) {
    let classes = element.classList;  
    if (!classes.contains("hidden")) classes.add("hidden"); 
}

// create tooltips shown when buttons hovered over
function createTooltip(tooltipText) {
    let tooltip = document.createElement("div");
    tooltip.className = "tooltip"; 
    let text = document.createElement("div");
    text.className = "tooltip-text";
    text.textContent = tooltipText; 
    let triangle = document.createElement("div");
    triangle.className = "tooltip-triangle"; 
    tooltip.append(triangle);
    tooltip.appendChild(text);
    return tooltip;
}
  
// setup functionality for buttons used to add, edit, delete, reset members
function setupMemberModeBtns() { 
    document.getElementById("add-btn").onclick = () => enterSelectMemberMode("add"); 
    document.getElementById("add-btn-box").append(createTooltip("Add Member"));

    document.getElementById("edit-btn").onclick = () => enterSelectMemberMode("edit"); 
    document.getElementById("edit-btn-box").append(createTooltip("Edit Member"));
 
    document.getElementById("delete-btn").onclick = () => enterSelectMemberMode("delete"); 
    document.getElementById("delete-btn-box").append(createTooltip("Delete Member")); 

    document.getElementById("refresh-btn").onclick = showWarningDialog;
    document.getElementById("refresh-btn-box").append(createTooltip("Reset")); 
}

// adjust ui to indicate selection mode 
function enterSelectMemberMode(modeType, subtitleText) {
    selectMode = modeType; 
    switch (modeType) {
        case "add":
            subtitleText = "Add To"; 
            break;
        case "edit":
            subtitleText = "Edit";
            break;
        case "delete":
            subtitleText = "Delete";
            break;
        default: 
            break;
    } 
    headerSubtitle.textContent = `Select Member Below to ${subtitleText}:`; 
    let subtitleBtn = document.getElementById("subtitle-btn")
    subtitleBtn.onclick = exitSelectMemberMode;
    showElement(subtitleBtn); 
}

function exitSelectMemberMode() {
    selectMode = null
    headerSubtitle.textContent = "Map Your Family History with Ease"; 
    let subtitleBtn = document.getElementById("subtitle-btn");
    hideElement(subtitleBtn);
}

// setup dialog warning user of action causing tree data reset
function setupWarningDialog() {
    dragElement(warningDialog, "warning-header"); 
    document.getElementById("cancel-warning-btn").onclick = () => warningDialog.close();
    document.getElementById("proceed-warning-btn").onclick = () => {
        resetTree();
        warningDialog.close();
    }
}

function showWarningDialog() {
    warningDialog.showModal(); 
    warningDialog.style.left = `${ window.innerWidth/2 - warningDialog.clientWidth/2 }px`; 
    warningDialog.style.top = `${ window.innerHeight/2 - warningDialog.clientHeight/2 }px`;  
}

// open popup showing clicked member's `extended` family (add-on spouses/children for non-main ancestors)
function setupExtendedTreeDialog() { 
    dragElement(extendedTreeDialog, "extended-tree-header");
    document.getElementById("close-tree-dialog-btn").onclick = closeExtendedTree;
}
 
function closeExtendedTree() {
    extendedTreeDialog.close(); 
    drawTree.closeExtendedTree();
    openDialogType = null;
}



/** Family Tree Functions */ 

function buildTree() {     
    treeUtils.positionMembers(members, levels);  
    drawTree.drawTree(members, levels, handleMemberClick, updateZoomProgress);  
}

function resetTree() {  
    setDefaultData();
    buildTree();  
}

// callback to add, edit, or delete selected member 
function handleMemberClick(clickedMember, memberNodeRect) {    
    if (selectMode) {
        selectedMember = members.get(clickedMember.memberID);    
        if (selectMode == "delete") {
            handleDelMember(); 
        } else {
            setFormValues(); 
            openDialogType = "form";   
            formDialog.showModal();  // open form to add/edit member 
            positionDialog(memberNodeRect, formDialog); 
        } 
    } else { 
        if (clickedMember.hiddenChildren?.length > 0) { 
            openDialogType = "tree";
            extendedTreeDialog.showModal(); 
            drawTree.drawExtendedTree(clickedMember.memberID);
            positionDialog(memberNodeRect, extendedTreeDialog); 
        }
    }
}

function positionDialog(clickedNode, dialog) {
    let dialogRight = clickedNode.right + 30 + dialog.offsetWidth; 
    if (dialogRight < window.innerWidth) {
        dialog.style.left = `${ clickedNode.right + 30 }px`;
    } else { 
        dialog.style.right = `${ clickedNode.right - 30 }px`;
    }  
    let top = openDialogType === "form" ? 70 : clickedNode.top - 20;
    dialog.style.top = `${top}px`; 
}

function handleAddMember() { 
    const relation = document.querySelector('input[name="relation"]:checked').value;  
    const newMemberData = { name: nameInput.value, image: selectedFormImgPath }; 
    try {
        switch (relation) {
            case "child":
                treeUtils.addChild(newMemberData, selectedMember.memberID, members, levels);
                break;
            case "parent":
                treeUtils.addParent(newMemberData, selectedMember.memberID, members, levels);
                break;
            case "sibling":
                treeUtils.addSibling(newMemberData, selectedMember.memberID, members, levels);
                break;
            case "spouse":
                treeUtils.addSpouse(newMemberData, selectedMember.memberID, members, levels);
                break;
            default:
                break;
        };
        buildTree();
    } catch (err) {  
        showSnackbar(err.message); 
    } 
}

function handleEditMember() {   
    let member = members.get(selectedMember.memberID);
    member.name = nameInput.value;
    member.image = selectedFormImgPath; 
    buildTree();
}

function handleDelMember() {
    try {
        treeUtils.deleteMember(selectedMember.memberID, members, levels);
        buildTree();
        exitSelectMemberMode();
    } catch(err) {
        showSnackbar(err.message); 
    }
}

function showSnackbar(message) {
    const snackbar = document.getElementById("snackbar");
    snackbar.textContent = message;
    snackbar.className = "show";
    setTimeout(() => { 
        snackbar.className = snackbar.className.replace("show", ""); 
    }, 3000); 
}



/** Add/Edit Member Form Functions */ 

function setupFormDialog() {  
    setupImgSelector();  
    dragElement(formDialog, "form-header");
    document.getElementById("cancel-form-btn").onclick = closeForm; 
    memberForm.onsubmit = (event) => {
        event.preventDefault();
        if (selectMode == "add") {
            handleAddMember(); 
        } else if (selectMode == "edit") {
            handleEditMember();
        } 
        closeForm();
    };
}

function setFormValues() { 
    let header = document.getElementById("form-header"); 
    let addMemberSection = document.getElementById("form-new-member-section"); 
    if (selectMode == "add") {
        header.textContent = "Add a New Member"; 
        showElement(addMemberSection);
        document.getElementById("selected-member-img").src = selectedMember.image;
        document.getElementById("selected-member-name").textContent = selectedMember.name; 
    } else {
        header.textContent = "Edit Member"
        hideElement(addMemberSection);
        selectedFormImg.src = selectedMember.image; 
        nameInput.value = selectedMember.name; 
    } 
}

// setup area to select or upload member image
function setupImgSelector() {
    const imgSelector = document.getElementById("form-default-img-options");  
    selectedFormImg.src = selectedFormImgPath; 

    // set default selectable images
    for (let i = 1; i <= defaultImgsCount; i++) { 
        let imgName = `assets/avatar${i}.png`;
        let img = document.createElement("img");
        img.className = "default-img";
        img.src = imgName;  
        img.onclick = () => {
            selectedFormImgPath = imgName;
            selectedFormImg.src = imgName; 
        };
        imgSelector.append(img);
    }; 
    imgSelector.append(createCustomImgSelector());
}

// setup option to upload custom member image 
function createCustomImgSelector() {
    let customImgSelector = document.createElement("label");
    customImgSelector.id = "custom-img-selector"; 
    customImgSelector.className = "btn-with-tooltip";
    customImgSelector.textContent = "+"; 
    customImgSelector.append(createTooltip("Upload an Image"));

    // setup file input for custom uploaded member pictures
    let fileInput = document.createElement("input");
    let fileInputErr = document.getElementById("file-error-msg");
    fileInput.type = "file";
    fileInput.accept="image/*";
    fileInput.onchange = () => {   
        const files = fileInput.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith("image/")) {
                hideElement(fileInputErr); 
                const reader = new FileReader(); 
                reader.onload = function (event) { 
                    // set uploaded file as member's image
                    selectedFormImgPath = event.target.result;
                    selectedFormImg.src = selectedFormImgPath;  
                }; 
                reader.readAsDataURL(file);
            } else {
                showElement(fileInputErr); 
            }
        }
    }  
    customImgSelector.append(fileInput);
    return customImgSelector;
}

function closeForm() {  
    let fileInputErr = document.getElementById("file-error-msg");
    nameInput.value = ""; 
    hideElement(fileInputErr);
    selectedMember = null;
    selectedFormImgPath = "assets/avatar1.png";
    selectedFormImg.src = selectedFormImgPath;  
    memberForm.reset();
    exitSelectMemberMode();
    openDialogType = null;
    formDialog.close();
}
  
// setup an element's draggable functionality
function dragElement(element, draggableAreaID) {
    const draggable = document.getElementById(draggableAreaID); 
    draggable.onmousedown = dragMouseDown;
    var newMouseX = 0, newMouseY = 0, startMouseX = 0, startMouseY = 0;

    // get starting cursor position
    function dragMouseDown(event) { 
        event.preventDefault(); 
        startMouseX = event.clientX;
        startMouseY = event.clientY;
        document.onmouseup = stopDrag; 
        document.onmousemove = startDrag;
    } 
    
     // calculate + set new cursor position
    function startDrag(event) { 
        event.preventDefault();
        newMouseX = startMouseX - event.clientX;
        newMouseY = startMouseY - event.clientY;
        startMouseX = event.clientX;
        startMouseY = event.clientY; 
        element.style.top = `${ element.offsetTop - newMouseY }px`;
        element.style.left = `${ element.offsetLeft - newMouseX }px`;
    }
  
    function stopDrag() { 
        document.onmouseup = null;
        document.onmousemove = null;
    }
}