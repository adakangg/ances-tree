/** 
 * Custom class that maps `Levels` and `Members` to their ID
 * Assigns & tracks ID values to ensure unique IDs for each item 
 */

class UniqueIDMap {  
  constructor(data) {  
    this.map = data.map;
    this.usedIDs = new Set(data.usedIDs);
    this.nextID = data.usedIDs.size+1; 
  }

  getNextID() {
    let newID = this.nextID;  
    while (this.usedIDs.has(newID)) {  
      newID++;
    }    
    return newID; 
  }
 
  set(id, value) { this.map.set(id, value); }
 
  delete(id) {
    if (this.map.has(id)) this.map.delete(id); 
  }
 
  get(id) { return this.map.get(id); } 
};



class MemberMap extends UniqueIDMap {
  constructor(data) { super(data); }
 
  set(id, value) { 
    super.set(id, value);
    this.usedIDs.add(id);  
    this.nextID = id + 1;  
  }
  
  delete(id) {
    super.delete(id);
    this.usedIDs.delete(id); 
  }  
}



class LevelMap extends UniqueIDMap {
  constructor(data) { super(data); }

  getNextMarriageID() { return super.getNextID(); }

  // Adds a new entry to the Map with a unique ID
  setMarriage(levelID, marriageID, marriage) { 
    let level = this.get(levelID);
    level.marriages.set(marriageID, marriage);
    this.usedIDs.add(marriageID); 
    this.nextID = marriageID + 1;  
  } 
    
  deleteMarriage(levelID, marriageID) {
    let level = this.get(levelID);
    if (level.marriages.has(marriageID)) {
      level.marriages.delete(marriageID);
      this.usedIDs.delete(marriageID); 
    }
  }  
}
  
export { LevelMap, MemberMap };