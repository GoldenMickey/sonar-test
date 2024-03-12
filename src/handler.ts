import { z } from 'zod';
import axios from 'axios';

export enum DataTarget {
    COUNT = 'count',
    AVG_AUTONOMY = 'avg_autonomy'
}
const zRequestPayload = z.object({
    body: z.string()
});

type RequestPayload = z.infer<typeof zRequestPayload>;

export async function handler(event: unknown): Promise<ProcessorResponse> {
    console.log('Received event', event);

    try {
        const processorData = zRequestPayload.parse(event);
        return new Processor(processorData).process();
    } catch(e: unknown) {
        console.error('An unexpected error occured', e);
        throw e;
    }
}

type ProcessorResponse = Record<string, number>;

const zProcessorApiDatum = z.union([z.null(), z.string(), z.number()]).array();
type ProcessorApiDatum = z.infer<typeof zProcessorApiDatum>;

const zProcessorApiData = z.object({
    meta: z.object({
        view: z.object({
            columns: z.object({
                name: z.string()
            }).array()
        })
    }),
    data: zProcessorApiDatum.array()
});
type ProcessorApiData = z.infer<typeof zProcessorApiData>;

class Processor {
    private readonly API_URL: string = 'https://data.wa.gov/api/views/f6w7-q2d2/rows.json';
    private readonly carmakerColumnName: string = 'Make';
    private readonly electricRangeColumnName: string = 'Electric Range';
    private readonly evTypeColumnName: string = 'Electric Vehicle Type';
    private readonly dataTarget: DataTarget;
    constructor(payload: RequestPayload) {
        this.dataTarget = z.nativeEnum(DataTarget).parse(JSON.parse(payload.body))
    }

    public async process(): Promise<ProcessorResponse> {
        switch (this.dataTarget) {
        case DataTarget.COUNT:
            return this.countCarsByCarMakers();
        case DataTarget.AVG_AUTONOMY:
            return this.avgAutonomyByCarMakers();
        default:
            throw new Error(`Unsupported data target ${this.dataTarget}`)
        }
    }

    private async getDataAndColumns(): Promise<{ columns: string[], data: ProcessorApiDatum[]}> {
        const res = await axios.get(this.API_URL);
        const parsedResponseData: ProcessorApiData = zProcessorApiData.parse(res.data);

        return {
            columns: parsedResponseData.meta.view.columns.map((c: any) => c.name),
            data: parsedResponseData.data
        }
    }

    private async countCarsByCarMakers(): Promise<ProcessorResponse> {
        const { columns, data}: { columns: string[], data: ProcessorApiDatum[]} = await this.getDataAndColumns();
        const carMakerColumnIndex = columns.indexOf(this.carmakerColumnName);

        const countByCarMakers: ProcessorResponse = {};
        const dataByCarMakers = this.dataCarsByCarMakers(carMakerColumnIndex, data);
        for(const k of Object.keys(dataByCarMakers)) {
            countByCarMakers[k] = dataByCarMakers[k].length;
        }

        return countByCarMakers;
    }

    private async avgAutonomyByCarMakers(): Promise<ProcessorResponse> {
        const { columns, data}: { columns: string[], data: ProcessorApiDatum[]} = await this.getDataAndColumns();
        const carMakerColumnIndex = columns.indexOf(this.carmakerColumnName);

        const avgAutonomyByCarMakers: ProcessorResponse = {};
        const dataByCarMakers = this.dataCarsByCarMakers(carMakerColumnIndex, data);

        const electricRangeColumnIndex = columns.indexOf(this.electricRangeColumnName);
        const evTypeColumnIndex = columns.indexOf(this.evTypeColumnName);

        for(const k of Object.keys(dataByCarMakers)) {
            const electricCars = dataByCarMakers[k].filter((d: ProcessorApiDatum) => d[evTypeColumnIndex] === 'Battery Electric Vehicle (BEV)');

            if(electricCars.length === 0) {
                avgAutonomyByCarMakers[k] = 0;
                continue;
            }

            avgAutonomyByCarMakers[k] = electricCars.reduce((acc: number, d: ProcessorApiDatum) => {
                const electricRange = d[electricRangeColumnIndex];
                if(typeof electricRange !== 'string') throw new Error(`Electric range is not a string for datum ${d} at index ${electricRangeColumnIndex}: ${d[electricRangeColumnIndex]}`);
                return acc+parseInt(electricRange);
            }, 0) / electricCars.length;
        }

        return avgAutonomyByCarMakers;
    }

    private dataCarsByCarMakers(carMakerColumnIndex: number, data: ProcessorApiDatum[]): Record<string, ProcessorApiDatum[]> {
        const dataByCarMakers: Record<string, ProcessorApiDatum[]> = {};

        for(const d of data) {
            const carmaker = d[carMakerColumnIndex];
            if(typeof carmaker !== 'string') throw new Error(`Car maker is not a string for datum ${d} at index ${carMakerColumnIndex}: ${d[carMakerColumnIndex]}`);

            if(dataByCarMakers[carmaker] === undefined) dataByCarMakers[carmaker] = [];
            dataByCarMakers[carmaker].push(d);
        }

        return dataByCarMakers;
    }
}