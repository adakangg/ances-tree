/** Represents each level on tree */

class Level {
  constructor({ levelID, marriages = new Map() } = {}) {
    this.levelID = levelID; 
    this.marriages = marriages;
  }  
};

export { Level };