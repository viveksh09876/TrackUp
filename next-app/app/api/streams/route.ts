import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';

export const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com\/(?:watch\?(?!.*\blist=)(?:.*&)?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]\S+)?$/;


const createStreamSchema = z.object({
    creatorId: z.string(),
    url: z.string()
})

export async function POST(req: NextRequest) {
    try {
        const data = createStreamSchema.parse(await req.json());
        const isYt = YT_REGEX.test(data.url)

        if (!isYt) {
            return NextResponse.json({
                message: "Wrong URL Format"
            }, { status: 411 });
        }

        const extractedId = data.url.split("?v=")[1]
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${extractedId}&format=json`;
        const res = await fetch(url);

        if (!res.ok) return null;
        const ytData = (await res.json()) as {
            title: string;
            author_name: string;
            thumbnail_url: string;
        };

        const stream = await prismaClient.stream.create({
            data: {
                userId: data.creatorId,
                url: data.url,
                extractedId,
                type: "Youtube",
                active: true,
                title: ytData.title,
                smallImg: ytData.thumbnail_url,
                bigImg: ytData.thumbnail_url.replace("hqdefault", "maxresdefault")  
            }
        })

        return NextResponse.json({
            message: "Stream added successfully",
            id: stream.id
        });

    } catch(e) {
        return NextResponse.json({
            message: `Error while adding a stream - ${e}`
        }, {
            status: 411
        })
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const creatorId = searchParams.get("creatorId")
    const session = await getServerSession();
    const user = await prismaClient.user.findFirst({
        where: {
            email: session?.user?.email ?? ""
        }
    })

    if (!user) {
        return NextResponse.json({
            message: "Unauthorized access not allowed"
        }, {
            status: 403
        })
    }

    if (!creatorId) {
        return NextResponse.json({
            message: "Error"
        }, { status: 411 })
    }

    const [streams, activeStream]  = await Promise.all([await prismaClient.stream.findMany({
        where: {
            userId: creatorId,
            played: false
        },
        include: {
            _count: {
                select: {
                    upvotes: true
                }
            },
            upvotes: {
                where: {
                    userId: user.id
                }
            }
        }
    }), prismaClient.currentStream.findFirst({
        where: {
            userId: creatorId
        },
        include: {
            stream: true
        }
    })])


    return NextResponse.json({
        streams: streams.map(({ _count, ...rest }) => ({
            ...rest,
            upvotesCount: _count.upvotes,
            haveUpvoted: rest.upvotes.length ? true : false
        })),
        activeStream
    });

}