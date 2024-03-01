"use client"

import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";
import { useToast } from "../ui/use-toast";
import { checkoutCredits } from "@/lib/actions/transaction.actions";
import { Button } from "../ui/button";

interface CheckoutProps {
    plan: string;
    amount: number;
    credits: number;
    buyerId: string;
}

const Checkout = ({ amount, buyerId, credits, plan }: CheckoutProps) => {

    const { toast } = useToast();

    useEffect(() => {

        const query = new URLSearchParams(window.location.search);

        if(query.get("success")) {
            toast({
                title: "Congratulations! Order Placed!",
                description: "You will receive an email confirmation",
                duration: 5000,
                className: "success-toast"
            })
        }

        if(query.get("canceled")) {
            toast({
                title: "Order canceled.",
                description: "Continue to shop around and checkout when you're ready.",
                duration: 5000,
                className: "error-toast"
            })
        }
    }, [])

    const onCheckout = async () => {
        const transaction = { plan, amount, credits, buyerId };

        await checkoutCredits(transaction);
    }

    return (
        <form action={onCheckout} method="POST">
            <section>
                <Button type="submit" role="link" className="w-full rounded-full bg-purple-gradient bg-cover">Buy Credits</Button>
            </section>
        </form>
    )
}

export default Checkout