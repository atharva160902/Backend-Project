import { request } from "express"
import { asyncHandler } from  "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"

const registerUser = asyncHandler( async (req, res) => {
    //Get user details from frontend
    //validation
    //check if user already exist
    //check fro image , avatar - compulsory
    //upload avatar to cloudinary
    //create user object - entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return response

    const { fullName, email, username, password} = req.body
    // console.log("email" , email);
    // console.log("req,body" , req.body);
    // console.log("req,body" , req.files);

    if(
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ){
        throw new apiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or : [{username},{email}]
    })

    if(existedUser){
        throw new apiError(409,"User with email or username already exists")
    }

    const avatarLoacalPath = req.files?.avatar[0]?.path
    // const coverImageLoacalPath = req.files?.coverImage[0]?.path

    let coverImageLoacalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLoacalPath = req.files.coverImage[0].path
    }

    if(!avatarLoacalPath){
        throw new apiError(400, "avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLoacalPath)
    const coverImage = await uploadOnCloudinary(coverImageLoacalPath)

    if(!avatar){
        throw new apiError(400, "avatar is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new apiError(500, "Something went wrong while registering")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "User Registered successfully")
    )

})

export { registerUser }