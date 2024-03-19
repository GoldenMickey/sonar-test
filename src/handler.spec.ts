import { expect } from 'chai';
import { handler } from './handler.js';

describe('Nominal', () => {
    // it('Throws an error if req is not an expected string', async () => {
    //     try {
    //         const req: string = 'random';
    //         await handler(req);
    //     } catch (e: unknown) {
    //         expect(e instanceof ZodError).to.be.true;
    //     }
    // });

    // it('Cars by car makers', async () => {
    //     const req: { body: string } = { body: JSON.stringify({ target: 'count' }) };
    //     console.time('Count call');
    //     const carsByCarMakers = await handler(req);
    //     console.timeEnd('Count call');
    //     console.log('Count result', carsByCarMakers)
    //     expect((carsByCarMakers as Record<string, number>)['BMW']).to.be.a('number');
    // });

    it('Average autonomy by car makers', async () => {
        const req: { body: string } = { body: JSON.stringify({ target: 'avg_autonomy', maker: 'TESLA' }) };
        console.time('Average autonomy call');
        const toyotaAvgEvCarAutonomy = await handler(req);
        console.timeEnd('Average autonomy call');
        console.log('Average autonomy result', toyotaAvgEvCarAutonomy)
        expect(toyotaAvgEvCarAutonomy).to.be.a('number');
    });
});