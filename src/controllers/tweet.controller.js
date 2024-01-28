import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const {content} = req.body

    if(!content){
        throw apiError(400,"Tweet cannot be empty")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    return res
    .status(201)
    .json(apiResponse(201, tweet, "Tweet created Successfully"))
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const {userId} = req.params
    // const userId = req.user?._id

    if(!isValidObjectId(userId)){
        throw apiError(400, "Invalid user id")
    }

    const tweets = await Tweet.find({owner: userId})

    return res
    .status(200)
    .json(apiResponse(200, tweets, "User tweets retrieved successfully"))


})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {tweetId} = req.params
    const {content} = req.body

    if(!isValidObjectId(tweetId)){
        throw apiError(400, "Invalid tweet id")
    }

    if(content.trim().length === 0){
        throw apiError(400, "Tweet cannot be empty")
    }

    const tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set : {
                content : content
            }
        },
        {
            new : true
        }
    )

    return res
    .status(200)
    .json(new apiResponse(200,tweet,"Tweet updated successfully"))

})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const tweetId = req.params

    if(!isValidObjectId(tweetId)){
        throw apiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findByIdAndDelete(tweetId)

    return res
    .status(200)
    .json(200,tweet,"Tweet deleted successfully")
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}