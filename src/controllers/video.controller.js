import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary ,deleteFromCloudinary} from "../utils/cloudinary.js"



const getAllVideos = asyncHandler(async (req, res) => {
    const { page, limit, query, sortBy, sortType, userId } = req.query
    // get all videos based on query, sort, pagination
    // run a query -
    // we also check for query i.e. through which we can search from search bar
    // also important take care of not showing videos with isPublic = false
    // first check for page and limit
    // sortBy - createdAt , views , duration
    // sortType - ascending , descending
    // sort by UserId i.e get all the videos of user

    
    const options = {
        page : parseInt(page,10) || 1,
        limit : parseInt(limit,10) || 10
    }
    console.log(options);

    const pipeline = []

    if (query) {
        pipeline.push({
            $match: { $or : [
                { title: { $regex: query, $options: "i" } },
                { description: { $regex: query, $options: "i" } },
            ]}
        })
    }

    if (sortBy){
        pipeline.push({
            $sort: { sortBy: sortType === "ascending" ? 1 : -1 }
        })
    }

    // pipeline.push({
    //     $match: { isPublished: true }
    // })

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new apiError(400, "Invalid userId");
        }
        console.log("userId",userId);
        pipeline.push({
            $match: { owner: mongoose.Types.ObjectId(userId) }
        })
    }

    // pipeline.push(
    //     {
    //       $lookup: {
    //         from: "users",
    //         localField: "owner",
    //         foreignField: "_id",
    //         as: "ownerDetails",
    //       }
    //     },
    //     {
    //       $unwind: "$ownerDetails"
    //     },
    //     {
    //       $project: {
    //         title: 1,
    //         description: 1,
    //         videoFile: 1,
    //         thumbnail: 1,
    //         owner: 1,
    //         duration: 1,
    //         views: 1,
    //         isPublished: 1,
    //         ownerDetails: {
    //           _id: 1,
    //           fullName: 1,
    //           username: 1,
    //           email: 1,
    //           avatar: 1,
    //         }
    //       }
    //     }
    // )
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    console.log("pipline",pipeline)
    
    const videos = await Video.aggregate(pipeline);
    console.log("videos",videos)
    
    const videosPaginated = await Video.aggregatePaginate(videos,options)
    console.log("videoPaginated",videosPaginated)
    
    return res
    .status(200)
    .json(
        new apiResponse(200,videosPaginated,"videos fetched successfully")
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    
    const { title, description} = req.body

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new apiError(400, "All fields are required");
    }
    
    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    if (!videoFileLocalPath) {
        throw new apiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new apiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new apiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new apiError(400, "Thumbnail not found");
    }

    if(!thumbnail || !videoFile){ 
        throw new apiError(500,"uploading error when uploading either video or thumbnail to cloudinary") ;
    }

    const video = await Video.create({
        videoFile:videoFile.url ,
        thumbnail:thumbnail.url ,
        owner:req.user._id,
        title,
        description,
        duration:videoFile.duration ,
        isPublished: false
    })

    return res
    .status(201)
    .json(
        new apiResponse(201,video,"video is published")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    //Get video by id

    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new apiError(404, "Video not found");
    }

    return res
    .status(200)
    .json(
        new apiResponse(200,video,"video found")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    //update video details like title, description, thumbnail

    const { videoId } = req.params
    const { title, description } = req.body
    
    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const obj = {}

    console.log(req.files)
    const thumbnailLocalPath = req.files?.thumbnail[0].path;
    console.log(thumbnailLocalPath);

    if (thumbnailLocalPath) {
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumbnail) {
            throw new apiError(500, "Error while uploading thumbnail");
        }
        console.log("thumbnail",thumbnail);
        obj.thumbnail = thumbnail.url;
    }

    if(title){
        obj.title = title
    }

    if(description){
        obj.description = description
    }

    if(Object.keys(obj).length === 0){
        throw new apiError(400,"No fields to update")
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $set: obj},
        { new: true }
    )

    return res
    .status(200)
    .json(
        new apiResponse(200,video,"video details are updated")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new apiError(404,"video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new apiError(403, "You are not authorized to perform this action");
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) {
        throw new apiError(500, "Failed to delete video");
    }

    await deleteFromCloudinary(video.videoFile, "video")
    await deleteFromCloudinary(video.thumbnail)

    return res
    .status(200)
    .json(
        new apiResponse(200,video,"video deleted successfully")
    )


})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }
    const video = await Video.findById(videoId);

    if (!video) {
        throw new apiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new apiError(403, "You are not authorized to perform this action");
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    ).select("isPublished");

    if (!toggledVideoPublish) {
        throw new apiError(500, "Failed to toogle video publish status");
    }

    return res
    .status(200)
    .json(
        new apiResponse(200,toggledVideoPublish,"video publish status toggled")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}