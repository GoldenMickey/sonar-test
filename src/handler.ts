import { z } from 'zod';
import axios from 'axios';

export enum DataTarget { COUNT = 'count', AVG_AUTONOMY = 'avg_autonomy' }
const zRequestPayload = z.object({ body: z.string() });

const zProcessorData = z.union([
    z.object({
        target: z.literal(DataTarget.COUNT),
    }),
    z.object({
        target: z.literal(DataTarget.AVG_AUTONOMY),
        maker: z.string()
    })
]);
type ProcessorData = z.infer<typeof zProcessorData>;

export async function handler(event: unknown): Promise<ProcessorResponse> {
    console.log('Received event', event);

    try {
        const payload = zRequestPayload.parse(event);
        const processorData = zProcessorData.parse(JSON.parse(payload.body))
        return new Processor(processorData).process();
    } catch(e: unknown) {
        console.error('An unexpected error occured', e);
        throw e;
    }
}

type ProcessorResponse = Record<string, number> | number;

const zProcessorApiDatum = z.union([z.null(), z.string(), z.number()]).array();
type ProcessorApiDatum = z.infer<typeof zProcessorApiDatum>;

class Processor {
    private readonly API_URL: string = 'https://data.wa.gov/api/views/f6w7-q2d2/rows.json';
    private readonly carmakerColumnIndex: number = 14;
    private readonly evTypeColumnIndex: number = 16;
    private readonly electricRangeColumnIndex: number = 18;
    constructor(private readonly payload: ProcessorData) {}

    public async process(): Promise<ProcessorResponse> {
        switch (this.payload.target) {
        case DataTarget.COUNT:
            return this.countCarsByCarMakers();
        case DataTarget.AVG_AUTONOMY:
            return this.avgAutonomyByCarMaker(this.payload.maker);
        }
    }

    private async *getRowGenerator(): AsyncGenerator<ProcessorApiDatum[]> {
        const response = await axios.get(this.API_URL, { responseType: 'stream' });
        const textDecoder = new TextDecoder();

        const dataStartRegex = new RegExp('"data" : \\[');
        const rowRegex = new RegExp('\\[.*?\\]', 'g');
        let data = '';
        let rowGenerationStart = false;
        for await (const d of response.data) {
            data += textDecoder.decode(d);

            if(rowGenerationStart === false) {
                const dataStartRegexMatch = data.match(dataStartRegex);
                if(!(dataStartRegexMatch !== null && dataStartRegexMatch.index !== undefined)) continue;

                data = data.slice( dataStartRegexMatch.index + dataStartRegexMatch[0].length );
                rowGenerationStart = true;
            }

            const rowMatch = data.match(rowRegex);
            if(rowMatch === null) continue;

            const lastRow = rowMatch[rowMatch.length-1];
            const lastRowIndexInData = data.indexOf(lastRow);
            data = data.slice( lastRowIndexInData + lastRow.length );

            const rows = zProcessorApiDatum.array().parse(JSON.parse(`[${rowMatch.join(',')}]`));
            yield rows;
        }
    }

    private async countCarsByCarMakers(): Promise<ProcessorResponse> {
        const rowGenerator = await this.getRowGenerator();

        const carsByCarMakers: Record<string, number> = {};

        for await (const rows of rowGenerator) {
            for (const row of rows) {
                const maker = row[this.carmakerColumnIndex];
    
                if(typeof maker !== 'string') throw new Error(`Unexpected type of value maker: ${maker}`);

                const carsCount: number = carsByCarMakers[maker] || 0;
                carsByCarMakers[maker] = carsCount+1;
            }
        }

        return carsByCarMakers;
    }

    private async avgAutonomyByCarMaker(targetMaker: string): Promise<number> {
        const rowGenerator = await this.getRowGenerator();
        
        const carsAutonomy: number[] = [];
        for await (const rows of rowGenerator) {
            for (const row of rows) {
                const maker = row[this.carmakerColumnIndex];
                const type = row[this.evTypeColumnIndex];
    
                if(typeof type !== 'string') throw new Error(`Unexpected type of value type: ${type}`);
                if(typeof maker !== 'string') throw new Error(`Unexpected type of value maker: ${maker}`);
                if(maker !== targetMaker || type !== 'Battery Electric Vehicle (BEV)') continue;

                const electricRange = row[this.electricRangeColumnIndex];
                if(typeof electricRange !== 'string') throw new Error(`Unexpected type of value electricRange: ${electricRange}`);
                carsAutonomy.push(parseInt(electricRange));
            }
        }

        return (carsAutonomy.reduce((acc: number, curr: number) => acc+curr, 0) / carsAutonomy.length);
    }
}