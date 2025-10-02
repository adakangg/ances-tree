/** 
 * Custom class that maps `Levels` and `Members` to their ID
 * Tracks used ID values to ensure unique IDs assigned for each item 
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
 
  set(id, value) { this.map.set(id, value) }
 
  delete(id) { if (this.map.has(id)) this.map.delete(id) }
 
  get(id) { return this.map.get(id) } 
};

export class MemberMap extends UniqueIDMap {
  constructor(data) { super(data) }
 
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

export class LevelMap extends UniqueIDMap {
  constructor(data) { super(data) }

  getNextMarriageID() { return super.getNextID() }

  // adds new entry with unique ID to the Map
  setMarriage(levelID, marriageID, marriage) { 
    const level = this.get(levelID);
    level.marriages.set(marriageID, marriage);
    this.usedIDs.add(marriageID); 
    this.nextID = marriageID + 1;  
  } 
    
  deleteMarriage(levelID, marriageID) {
    const level = this.get(levelID);
    if (level.marriages.has(marriageID)) {
      level.marriages.delete(marriageID);
      this.usedIDs.delete(marriageID); 
    }
  }  
} 