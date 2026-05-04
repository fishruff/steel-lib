type Steel ={
    name: string,
    standard?:string,
    C: {
        min:number,        
        max:number,        
    },
    Mn: number,
    yieldStrength:number
}

const steelArr: Steel[] = [
    { name: "09Г2С", C: {"min": 0.17, "max": 0.24}, Mn: 1.6, yieldStrength: 345 },
    { name: "Ст3", C: {"min": 0.17, "max": 0.24}, Mn: 0.5, yieldStrength: 235 },
    { name: "20", C: {"min": 0.17, "max": 0.24}, Mn: 0.5, yieldStrength: 245 },
    { name: "30", C: {"min": 0.17, "max": 0.24}, Mn: 0.6, yieldStrength: 355 },
    { name: "40Х", C: {"min": 0.17, "max": 0.24}, Mn: 0.8, yieldStrength: 600 },
    { name: "30ХГСА", C: {"min": 0.17, "max": 0.24}, Mn: 0.8, yieldStrength: 700 },
    { name: "15ГС", C: {"min": 0.17, "max": 0.24}, Mn: 1.3, yieldStrength: 390 },
    { name: "10Г2", C: {"min": 0.17, "max": 0.24}, Mn: 1.5, yieldStrength: 345 },
    { name: "35", C: {"min": 0.17, "max": 0.24}, Mn: 0.7, yieldStrength: 500 },
    { name: "45", C: {"min": 0.19, "max": 0.34}, Mn: 0.7, yieldStrength: 600 }
  ]

  const getSteel = (name:string)=>{
    return steelArr.find(s=>s.name ===name)
  }

const compareSteel=(aName:string, bName:string)=>{
    const a = getSteel(aName);
    const b = getSteel(bName);

    if(!a || !b) return null

    return calculateSimilarity(a,b)

}

const calculateSimilarity= (a:Steel, b:Steel)=>{
    const Cdiff = Math.abs(a.C.max - b.C.max);
    const Mndiff = Math.abs(a.Mn - b.Mn);
    const Yielddiff =  Math.abs(a.yieldStrength - b.yieldStrength);

    const Csim = 1 - Cdiff / 1;
    const Mnsim = 1 - Mndiff / 2;
    const Yieldsim = 1 - Yielddiff / 1000;

    const similarity = 
        Csim *  .5 +
        Mnsim * .2 +
        Yieldsim * .3

        return {similarity,
            details: {
                Cdiff,
                Mndiff,
                Yielddiff: Yielddiff

            }
}
}

const findSimilar = (s: string)=>{
    const base = getSteel(s);
    if (!base) return null
    const result = steelArr.filter(i=>i.name!==base.name)
    // .map(item=>calculateSimilarity(item,base))
    .map(item =>({
        steel: item.name,
        similarity: calculateSimilarity(item, base).similarity
    }))
    .sort((a, b) => b.similarity - a.similarity);
    return result
}

type Range1 = {
    min: number,
    max: number
}


const compareRange=(a: Range1, b: Range1): number=>{
    const overlap = 
    Math.min(a.max, b.max) - 
    Math.max(a.min, b.min);

    if (overlap<0) return 0
    

    const total = 
    Math.max(a.max, b.max)-
    Math.min(a.min, b.min); 

    if (total===0) return 1
    

    const similarity = overlap/total;

    return similarity
}
console.log(compareRange({min:0.12, max:0.30},{min:0.17, max:0.34}))
// console.log(findSimilar("09Г2С"))
