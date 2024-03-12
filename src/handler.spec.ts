import { expect } from 'chai';
import { ZodError } from 'zod';
import { handler } from './handler.js';

describe('Nominal', () => {
    it('Throws an error if req is not an expected string', async () => {
        try {
            const req: string = 'random';
            await handler(req);
        } catch (e: unknown) {
            expect(e instanceof ZodError).to.be.true;
        }
    });

    // it('Cars by car makers', async () => {
    //     const req: string = 'count';
    //     const carsByCarMakers = await handler(req);
    //     expect(carsByCarMakers['BMW']).to.be.a('number');
    //     expect(carsByCarMakers['BMW']).to.equal(7465);
    // });

    // it('Average autonomy by car makers', async () => {
    //     const req: string = 'avg_autonomy';
    //     const avgAutonomyByCarMakers = await handler(req);
    //     expect(avgAutonomyByCarMakers['JEEP']).to.be.a('number');
    //     expect(avgAutonomyByCarMakers['JEEP']).to.equal(0);

    //     expect(avgAutonomyByCarMakers['TOYOTA']).to.be.a('number');
    //     expect(avgAutonomyByCarMakers['TOYOTA']).to.equal(17.75);
    // });
});