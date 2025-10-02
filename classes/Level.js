/** Represents each level on tree which consists of siblings/cousins + their spouses */

export class Level {
  constructor({ levelID, marriages = new Map() } = {}) {
    this.levelID = levelID; 
    this.marriages = marriages;
  }  
}; 