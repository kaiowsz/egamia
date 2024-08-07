"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormLabel, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "../ui/input";
import { aspectRatioOptions, defaultValues, transformationTypes } from "@/constants";
import { CustomField } from "./CustomField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useTransition } from "react";
import { AspectRatioKey, debounce, deepMergeObjects } from "@/lib/utils";
import { updateCredits } from "@/lib/actions/user.actions";
import MediaUploader from "./MediaUploader";
import TransformedImage from "./TransformedImage";
import { getCldImageUrl } from "next-cloudinary";
import { addImage, updateImage } from "@/lib/actions/image.actions";
import { useRouter } from "next/navigation";
import InsufficientCreditsModal from "./InsufficientCreditsModal";

import { toast } from "../ui/use-toast";

export const formSchema = z.object({
    title: z.string(),
    aspectRatio: z.string().optional(),
    color: z.string().optional(),
    prompt: z.string().optional(),
    publicId: z.string()
})

const TransformationForm = ({action, data = null, userId, type, creditBalance, config = null}: TransformationFormProps) => {


    const transformationType = transformationTypes[type];

    const creditFee = transformationTypes[type].creditFee;

    const [image, setImage] = useState(data);
    const [newTransformation, setNewTransformation] = useState<Transformations | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const [transformationConfig, setTransformationConfig] = useState(config);

    const [isPending, startTransition] = useTransition();

    const router = useRouter();

    const initialValues = data && action === "Update" 
    ? {
        title: data?.title,
        aspectRatio: data?.aspectRatio,
        color: data?.color,
        prompt: data?.prompt,
        publicId: data?.publicId
    } : defaultValues;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: initialValues
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);

        if(!values.title) {
            toast({
                title: "Title is required",
                description: "Please, insert a title before submitting the image."
            })

            setIsSubmitting(false);

            return;
        }

        if(data || image) {
            const transformationUrl = getCldImageUrl({
                width: image?.width,
                height: image?.height,
                src: image?.publicId,
                ...transformationConfig
            });

            const imageData = {
                title: values.title,
                publicId: image?.publicId,
                transformationType: type,
                width: image?.width,
                height: image?.height,
                config: transformationConfig,
                secureURL: image?.secureURL,
                transformationURL: transformationUrl,
                aspectRatio: values.aspectRatio,
                prompt: values.prompt,
                color: values.color
            }

            if(action === "Add") {
                try {
                    const newImage = await addImage({
                        image: imageData,
                        userId,
                        path: "/"
                    });

                    console.log("Here")

                    if(newImage) {
                        form.reset();
                        setImage(data);

                        router.push(`/transformations/${newImage._id}`)
                    }
                } catch (error) {
                    console.log(error);
                }
            }

            if(action === "Update") {
                try {
                    const updatedImage = await updateImage({
                        image: {
                            ...imageData,
                            _id: data._id
                        },
                        userId,
                        path: `/transformations/${data._id}`
                    });

                    if(updatedImage) {
                        router.push(`/transformations/${updatedImage._id}`) 
                    }
                } catch (error) {
                    console.log(error);
                }
            }

            setIsSubmitting(false);
        }
    }

    function onSelectFieldHandler(value: string, onChangeField: (value: string) => void) {
        const imageSize = aspectRatioOptions[value as AspectRatioKey];

        setImage((prevState: any) => ({
            ...prevState,
            aspectRatio: imageSize.aspectRatio,
            width: imageSize.width,
            height: imageSize.height,
        }))

        setNewTransformation(transformationType.config);

        return onChangeField(value);
    }

    function onInputChangeHandler(fieldName: string, value: string, type: string, onChangeField: (value: string) => void) {
        debounce(() => {
            setNewTransformation((prevState: any) => ({
                ...prevState,
                [type]: {
                    ...prevState?.[type],
                    [fieldName === "prompt" ? "prompt" : "to"]: value
                }
            }))
        }, 1000)();

        return onChangeField(value);
    }

    async function onTransformHandler() {
        setIsTransforming(true);

        setTransformationConfig(
            deepMergeObjects(newTransformation, transformationConfig)
        )

        setNewTransformation(null);

        startTransition(async () => {
            await updateCredits(userId, creditFee);

            toast({
                title: "Image uploaded successfully.",
                description: `${Math.abs(creditFee) > 1 ? `${Math.abs(creditFee)} credits` : "1 credit"} was deducted from your account`,
                duration: 5000,
                className: "success-toast"
            })
        })
    }

    useEffect(() => {
        if(image && (type === "restore" || type === "removeBackground")) {
            setNewTransformation(transformationType.config)
        }

        console.log(image);
    }, [image, transformationType.config, type])

    return (
        <Form {...form}>
            <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
                {creditBalance < Math.abs(creditFee) && <InsufficientCreditsModal/>}
                <CustomField control={form.control} name="title" formLabel="Image Title" className="w-full" render={({field}) => <Input {...field} className="input-field" />} />

                {type === "fill" && (
                    <CustomField control={form.control} name="aspectRatio" formLabel="Aspect Ratio" className="w-full" render={({field}) => (
                        <Select onValueChange={(value) => onSelectFieldHandler(value, field.onChange)} value={field.value}>
                            <SelectTrigger className="select-field">
                                <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(aspectRatioOptions).map(key => (
                                    <SelectItem key={key} value={key} className="select-item">
                                        {aspectRatioOptions[key as AspectRatioKey].label}
                                    </SelectItem>

                                ))}
                            </SelectContent>
                        </Select>
                    )} />
                )}

                {(type === "remove" || type === "recolor") && (
                    <div className="prompt-field">
                        <CustomField control={form.control} name="prompt" formLabel={type === "remove" ? "Object to remove" : "Object to recolor"} className="w-full" render={({field}) => (
                            <Input value={field.value} className="input-field" onChange={(e) => onInputChangeHandler("prompt", e.target.value, type, field.onChange)} />
                        )} />

                        {type === "recolor" && (
                            <CustomField control={form.control} name="color" formLabel="Replacement Color" className="w-full" render={({field}) => (
                                <Input value={field.value} className="input-field" onChange={(e) => onInputChangeHandler("color", e.target.value, "recolor", field.onChange)} />
                            )} />
                        )}

                    </div>
                )}

                <div className="media-uploader-field">
                    <CustomField control={form.control} name="publicId" className="flex size-full flex-col" render={({field}) => (
                        <MediaUploader
                            onValueChange={field.onChange}
                            setImage={setImage}
                            publicId={field.value}
                            image={image}
                            type={type}
                        />
                    )} />

                    <TransformedImage image={image} type={type} title={form.getValues().title} isTransforming={isTransforming} setIsTransforming={setIsTransforming} transformationConfig={transformationConfig} />
                </div>

                <div className="flex flex-col gap-4">
                    <p>*Note: the transformation may take up to 5 minutes or more.</p>
                    <Button 
                    type="button" 
                    className="submit-button capitalize"
                    onClick={onTransformHandler} 
                    disabled={isTransforming || newTransformation === null}>
                        {isTransforming ? "Transforming..." : `Apply transformation (${Math.abs(creditFee)} Credits)`}
                    </Button>


                    <Button 
                    type="submit" 
                    className="submit-button capitalize" 
                    disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Save image"}
                    </Button>
                </div>

            </form>
        </Form>
    )
}

export default TransformationForm