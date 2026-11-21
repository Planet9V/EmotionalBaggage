// Stand-in for a CaseMaker dependency this application does not use (STEP import, font parsing).
// Reaching it is an error, not a silent no-op.
const fail = () => { throw new Error("This part of CaseMaker is not included in this application's fork."); };
export default new Proxy(fail, { get: () => fail });
export const load = fail;
export const parse = fail;
