import * as drawMainTree from './scripts/draw-tree-utils.js';
import * as treeUtils from './scripts/tree-utils.js';  
import { LevelMap, MemberMap } from './classes/UniqueIDMap.js';
import { Level } from './classes/Level.js';
import { Marriage } from './classes/Marriage.js';
import { Member } from './classes/Member.js'; 
 
let levels = null, members = null;    
let currentAction = { type: null, dialogType: null, member: null }; 
const extendedTreeDialogEl = document.getElementById("extended-tree-dialog");  
const memberForm = {
    dialogEl: document.getElementById("member-form-dialog"), 
    selectedAvatarEl: document.getElementById("selected-avatar"), 
    nameInputEl: document.getElementById("member-name-input")
};
const modeButtons = [
    { type: "add", tooltip: "Add Member" },
    { type: "edit", tooltip: "Edit Member" },
    { type: "delete", tooltip: "Delete Member" },
    { type: "refresh", tooltip: "Reset", onClick: showWarningDialog },
];

window.onload = function () {  
    setDefaultData();
    setModeButtons();
    setMemberForm();     
    setExtendedTree();
    setWarningDialog(); 
    buildMainTree();   
    setTreeZoom();

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            e.preventDefault(); 
            if (currentAction.dialogType === "tree") {
                closeExtendedTree();
            } else if (currentAction.dialogType === "form") {
                closeMemberForm();
            }
            currentAction.dialogType = null;
        }
    });
}


/* Utility Functions */
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
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

function createEl(tag, props = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    return el;
}
 
function createBtnTooltip(button) {  
    const tooltip = createEl("div", { className: "tooltip flex-col-center" });
    const text = createEl("div", { 
        id: button.type ? `${button.type}-btn-tooltip-text` : "", 
        className: "tooltip-text",
        textContent: button.tooltip 
    }); 
    const triangle = createEl("div", { className: "tooltip-triangle" }); 
    tooltip.append(triangle);
    tooltip.appendChild(text); 
    return tooltip;
}  


/* Member Selection Mode Functions - (add/edit/delete/reset members) */ 
function setModeButtons() {  
    modeButtons.forEach(headerBtn => { 
        const btn = document.getElementById(`${headerBtn.type}-btn`);
        btn.append(createBtnTooltip(headerBtn)); 
        btn.addEventListener("click", () => {
            if (headerBtn.onClick) { 
                headerBtn.onClick();
            } else { 
                if (currentAction.type === headerBtn.type) {
                    exitSelectMemberMode(headerBtn.type, btn);
                } else if (!currentAction.type) {
                    enterSelectMemberMode(headerBtn.type, btn);
                } 
            }
        }); 
    });
}

// adjust ui to indicate selection mode 
function enterSelectMemberMode(modeType, modeButton) { 
    currentAction.type = modeType;     
    document.getElementById("header-subtitle").textContent = `Select Member To ${capitalize(modeType)} ${modeType === "add" ? " To" : ""}:`;  
    modeButton.classList.add("primary-bg"); 
    document.getElementById(`${modeType}-btn-tooltip-text`).textContent = "Exit Mode"; 
}

function exitSelectMemberMode(modeType = currentAction.type, button) { 
    document.getElementById("header-subtitle").textContent = "Building your Family Tree"; 
    const modeButton = button ?? document.getElementById(`${modeType}-btn`); 
    modeButton.classList.remove("primary-bg");
    if (modeType) {
        document.getElementById(`${modeType}-btn-tooltip-text`).textContent = `${capitalize(modeType)} Member`; 
    }
}


/** Main Family Tree Functions */  
function buildMainTree() {      
    drawMainTree.drawMainTree(members, levels, handleMemberClick, updateZoomProgress);  
}

function resetTree() {  
    setDefaultData();
    buildMainTree();  
}

function handleMemberClick(clickedMember, memberNodeRect) {     
    if (currentAction.type) {
        currentAction.member = members.get(clickedMember.memberID);    
        if (currentAction.type === "delete") {
            deleteTreeMember(); 
        } else { // open add/edit member form
            setMemberFormValues(); 
            currentAction.dialogType = "form";   
            if (currentAction.type === "edit") {
                document.getElementById("relation-selector").classList.add("hidden");
            }            
            memberForm.dialogEl.showModal();   
            positionDialog(memberNodeRect, memberForm.dialogEl); 
        } 
    } else { 
        if (clickedMember.hiddenChildren?.length > 0) { 
            currentAction.dialogType = "tree"; 
            extendedTreeDialogEl.showModal();  
            drawMainTree.drawExtendedTree(clickedMember.memberID, updateZoomProgress);
            positionDialog(memberNodeRect, extendedTreeDialogEl); 
        }
    }
}

function addTreeMember() {  
    const memberData = { 
        name: memberForm.nameInputEl.value, 
        image: memberForm.selectedAvatarEl.getAttribute("src") 
    };    
    const relation = document.querySelector('input[name="relation"]:checked').value;     
    try {
        switch (relation) {
            case "child":
                treeUtils.addChild(memberData, currentAction.member.memberID, members, levels);
                break;
            case "parent":
                treeUtils.addParent(memberData, currentAction.member.memberID, members, levels);
                break;
            case "sibling":
                treeUtils.addSibling(memberData, currentAction.member.memberID, members, levels);
                break;
            case "spouse":
                treeUtils.addSpouse(memberData, currentAction.member.memberID, members, levels);
                break;
            default:
                break;
        };
        buildMainTree();
    } catch (err) {  
        showSnackbar(err.message); 
    } 
}

function editTreeMember() {   
    const member = members.get(currentAction.member.memberID); 
    member.name = memberForm.nameInputEl.value; 
    member.image = memberForm.selectedAvatarEl.getAttribute("src") ; 
    buildMainTree();
}

function deleteTreeMember() {
    try {
        treeUtils.deleteMember(currentAction.member.memberID, members, levels);
        buildMainTree();
        exitSelectMemberMode();
    } catch(err) {
        showSnackbar(err.message); 
    }
}


/** Add/Edit Member Form Functions */  
function setMemberForm() {  
    setupAvatarSelect();  
    dragElement(memberForm.dialogEl, "member-form-header");
    document.getElementById("cancel-form-btn").addEventListener("click", closeMemberForm);
    document.getElementById("member-form").addEventListener("submit", e => {
        e.preventDefault();
        if (currentAction.type == "add") {
            addTreeMember(); 
        } else if (currentAction.type == "edit") { 
            editTreeMember();
        } 
        closeMemberForm();
    });
}

function setMemberFormValues() { 
    const header = document.getElementById("member-form-header");  
    const relationBtn = document.getElementById("child"); 
    if (currentAction.type == "add") {
        header.textContent = "Add a New Member";  
        document.getElementById("relation-label").textContent = `Relation to ${currentAction.member.name}:`; 
        relationBtn.required = true;
    } else {
        header.textContent = "Edit Member";
        memberForm.selectedAvatarEl.src = currentAction.member.image;
        memberForm.nameInputEl.value = currentAction.member.name; 
        relationBtn.required = false;
    } 
}

// area to select/upload member profile picture
function setupAvatarSelect() {
    document.getElementById("upload-avatar-btn").append(createBtnTooltip({ tooltip: "Browse"}));  
    const uploadInput = document.getElementById("upload-avatar-input");
    uploadInput.addEventListener("change", handleFileInput);   
    for (let i = 1; i <= 5; i++) { // set default selectable images
        const path = `assets/avatar${i}.png`; 
        const defaultImg = createEl("img", { className: "default-avatar", src: path });    
        defaultImg.addEventListener("click", () => memberForm.selectedAvatarEl.src = path);
        uploadInput.insertAdjacentElement("beforebegin", defaultImg);
    };   
}

 // set uploaded file as member's avatar 
function handleFileInput() { 
    const files = document.getElementById("upload-avatar-input").files; 
    if (files.length > 0) {
        const file = files[0];
        const fileInputErr = document.getElementById("file-error-msg"); 
        if (file.type.startsWith("image/")) { 
            fileInputErr.classList.add("hidden");
            const reader = new FileReader(); 
            reader.addEventListener("load", e => memberForm.selectedAvatarEl.src = e.target.result);
            reader.readAsDataURL(file);
        } else {
            fileInputErr.classList.remove("hidden");
        }
    }
}

function closeMemberForm() {  
    document.getElementById("file-error-msg").classList.add("hidden");
    memberForm.nameInputEl.value = ""; 
    memberForm.selectedAvatarEl.src = "assets/avatar1.png";  
    document.getElementById("member-form").reset();
    exitSelectMemberMode(); 
    document.getElementById("relation-selector").classList.remove("hidden");
    currentAction = { type: null, dialogType: null, member: null };
    memberForm.dialogEl.close();
}


/* Extended Tree Functions */ 
function setExtendedTree() { 
    dragElement(extendedTreeDialogEl, "extended-tree-header");
    document.getElementById("close-dialog-btn").addEventListener("click", closeExtendedTree);  
} 

function closeExtendedTree() {
    extendedTreeDialogEl.close();  
    drawMainTree.resetSelectedTree();
    currentAction.dialogType = null; 
}


/* Warning Dialog Functions */
function setWarningDialog() {  
    const warningDialog = document.getElementById("warning-dialog");
    document.getElementById("cancel-warning-btn").addEventListener("click", () => warningDialog.close()); 
    document.getElementById("proceed-warning-btn").addEventListener("click", () => {
        resetTree();
        warningDialog.close();
    });  
}

function showWarningDialog() {
    if (!currentAction.type) {
        const warningDialog = document.getElementById("warning-dialog");
        warningDialog.showModal(); 
        warningDialog.style.left = `${ window.innerWidth/2 - warningDialog.clientWidth/2 }px`; 
        warningDialog.style.top = `${ window.innerHeight/2 - warningDialog.clientHeight/2 }px`;  
    }
} 


/* Dialog Utility Functions */
function setTreeZoom() {
    document.getElementById("main-zoom-in-btn").addEventListener("click", () => drawMainTree.zoomIn());
    document.getElementById("main-zoom-out-btn").addEventListener("click", () => drawMainTree.zoomOut());  
}
 
function updateZoomProgress(zoomAmt, treeType) {   
    document.getElementById(`${treeType}-zoom-progress-value`).style.width = `${zoomAmt}%`; 
}

function dragElement(element, draggableAreaID) {
    document.getElementById(draggableAreaID).addEventListener("mousedown", dragMouseDown);
    let newMouseX = 0, newMouseY = 0, startMouseX = 0, startMouseY = 0;

    function dragMouseDown(event) { // get starting cursor position
        event.preventDefault(); 
        startMouseX = event.clientX;
        startMouseY = event.clientY; 
        document.addEventListener("mouseup", stopDrag);
        document.addEventListener("mousemove", startDrag);
    } 
    
    function startDrag(event) { // calculate + set new cursor position
        event.preventDefault();
        newMouseX = startMouseX - event.clientX;
        newMouseY = startMouseY - event.clientY;
        startMouseX = event.clientX;
        startMouseY = event.clientY; 
        element.style.top = `${ element.offsetTop - newMouseY }px`;
        element.style.left = `${ element.offsetLeft - newMouseX }px`;
    }
  
    function stopDrag() {  
        document.removeEventListener("mouseup", stopDrag);
        document.removeEventListener("mousemove", startDrag);
    }
}

function positionDialog(clickedNode, dialog) {
    const dialogRight = clickedNode.right + 30 + dialog.offsetWidth; 
    if (dialogRight < window.innerWidth) {
        dialog.style.left = `${clickedNode.right + 30}px`;
    } else { 
        dialog.style.right = `${clickedNode.right - 30}px`;
    }  
    const top = currentAction.dialogType === "form" ? 70 : clickedNode.top - 20;
    dialog.style.top = `${top}px`; 
}

function showSnackbar(message) {
    const snackbar = document.getElementById("snackbar");
    snackbar.textContent = message;
    snackbar.className = "show";
    setTimeout(() => {  
        snackbar.className = snackbar.className.replace("show", ""); 
    }, 3000); 
}