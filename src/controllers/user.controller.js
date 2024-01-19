import { asyncHandler } from  "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"

const generateAccesAndRefreshToken = async(userId) => {
    try {
        // console.log(user);
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()


        user.refreshToken = refreshToken
        user.save({ validateBeforeSave : false})

        return {refreshToken, accessToken}
        
    } catch (error) {
        throw new apiError(500,"something went wromg while generating refresh and access token")
    }
}

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

const loginUser = asyncHandler( async (req, res) => {
    // req.body -> data
    //username or email
    //find the user
    //password check
    // access token & refresh token
    //send cookies
    const {email, username, password} = req.body

    if(! (username || email)){
        throw new apiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!user){
        throw new apiError(400, "No user found / user does not exist")
    }

    const isPasswordvalid = await user.isPasswordCorrect(password)

    if(!isPasswordvalid){
        throw new apiError(401, "Password is incorrect")
    }

    // console.log(user);
    
    const {refreshToken, accessToken} = await generateAccesAndRefreshToken(user._id)

    // console.log(user);

    const loggedInUser = await User.findById(user._id).select("-password -refresToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new apiResponse(
            200,
            {
                user : loggedInUser,
                refreshToken,
                accessToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler( async (req, res) => { 

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie(`accessToken`,options)
    .clearCookie(`refreshToken`,options)
    .json(new apiResponse(200,{},"User logged out successfully"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {

    const incomingRefreshToken = req.cookie?.refreshToken || req.body?.refreshToken

    if(!incomingRefreshToken){
        throw new apiError(401,"Invalid access token")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = User.findById(decodedToken?._id)
        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {refToken,accToken} = await generateAccesAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("refreshToken",refToken,options)
        .cookie("accessToken",accToken,options)
        .json(new apiResponse(
            200,
            {
                refreshToken : refToken,
                accessToken : accToken
            },
            "Access token refreshed"
        ))
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}