type Steel ={
    name: string,
    standard?:string,
    C: number,
    Mn: number,
    yieldStrength:number
}

const steelArr: Steel[] = [
    { name: "09Г2С", C: 0.09, Mn: 1.6, yieldStrength: 345 },
    { name: "Ст3", C: 0.14, Mn: 0.5, yieldStrength: 235 },
    { name: "20", C: 0.2, Mn: 0.5, yieldStrength: 245 },
    { name: "30", C: 0.3, Mn: 0.6, yieldStrength: 355 },
    { name: "40Х", C: 0.4, Mn: 0.8, yieldStrength: 600 },
    { name: "30ХГСА", C: 0.3, Mn: 0.8, yieldStrength: 700 },
    { name: "15ГС", C: 0.15, Mn: 1.3, yieldStrength: 390 },
    { name: "10Г2", C: 0.1, Mn: 1.5, yieldStrength: 345 },
    { name: "35", C: 0.35, Mn: 0.7, yieldStrength: 500 },
    { name: "45", C: 0.45, Mn: 0.7, yieldStrength: 600 }
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
    const Cdiff = Math.abs(a.C - b.C);
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
console.log(findSimilar("09Г2С"))
// console.log(compareSteel("09Г2С", "Ст3"))