import { Address, Order, Product, Cart } from "@prisma/client";
import axios from "axios";
import { number, string, object } from "zod";

// Type Definitions
type CartItem = {
    cart_item_id: string;
    cart_id: string;
    product_id: string;
    quantity: number;
    color: string;
    product: Product;
};

type Bill = {
    subTotal: number;
    total: number;
    discount: number;
    deliveryFee: number;
    tax: number;
};

type User = {
    user_id: string;
    email: string;
    full_name: string | null;
    phone_number: string | null;
    cart: Cart | null;
};

type PackageDetails = {
    delivery_postcode: string;
    weight: number;
    cod: number; // 1 for COD, 0 for Prepaid
    declared_value: number;
    pickup_address_location: string;
};

// Helper Function for Headers
const getShiprocketHeaders = () => ({
    Authorization: `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
});

// Create Shiprocket Shipment
export const createShiprocketShipment = async (order: Order, user: User, cartItems: CartItem[], address: Address) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
            {
                order_id: order.order_id,
                order_date: order.order_date.toISOString(),
                billing_customer_name: user.full_name || "",
                billing_last_name: "",
                billing_address: address.street,
                billing_city: address.city,
                billing_pincode: address.postal_code,
                billing_state: address.state,
                billing_country: address.country,
                billing_email: user.email || "",
                billing_phone: user.phone_number || "",
                shipping_is_billing: true,
                order_items: cartItems.map(item => ({
                    name: item.product.name,
                    sku: item.product.SKU,
                    units: item.quantity,
                    selling_price: item.product.price,
                    discount: (item.product.discount_percent / 100 * item.product.price) || 0
                })),
                payment_method: order.payment_method,
                sub_total: order.sub_total,
                length: 10, // Replace with actual length
                breadth: 10, // Replace with actual breadth
                height: 10, // Replace with actual height
                weight: 1.5  // Replace with actual weight
            },
            {
                headers: getShiprocketHeaders()
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error creating Shiprocket shipment:', error);
        throw new Error('Failed to create Shiprocket shipment');
    }
};

// Select Best Courier
export const selectBestCourier = async (packageDetails: PackageDetails) => {
    try {
        const pickupResponse = await axios.get(
            'https://apiv2.shiprocket.in/v1/external/settings/company/pickup',
            { headers: getShiprocketHeaders() }
        );

        const pickupPincode = pickupResponse.data.data.shipping_address.find((address: any) =>
            address.pickup_location === packageDetails.pickup_address_location
        )?.pin_code;

        if (!pickupPincode) {
            throw new Error('Pickup pincode not found for the specified pickup address location.');
        }

        const courierResponse = await axios.get(
            'https://apiv2.shiprocket.in/v1/external/courier/serviceability/',
            {
                headers: getShiprocketHeaders(),
                params: {
                    pickup_postcode: pickupPincode,
                    delivery_postcode: packageDetails.delivery_postcode,
                    cod: packageDetails.cod,
                    weight: packageDetails.weight,
                    declared_value: packageDetails.declared_value
                }
            }
        );

        const bestCourier = courierResponse.data.data.available_courier_companies.reduce((prev: any, curr: any) => {
            if (curr.estimated_delivery_days <= 4) {
                if (!prev || curr.freight_charge < prev.freight_charge) {
                    return curr;
                }
            }
            return prev;
        }, null);

        if (!bestCourier) {
            throw new Error('No suitable courier found with delivery within 4 days.');
        }

        return bestCourier;
    } catch (error) {
        console.error('Error fetching Shiprocket courier partners:', error);
        throw new Error('Error fetching Shiprocket courier partners.');
    }
};

// Generate AWB Code
export const generateAWBCode = async (shipment_id: number, courier_id: number) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
            { shipment_id, courier_id },
            { headers: getShiprocketHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error generating AWB code:', error);
        throw new Error('Failed to generate AWB code');
    }
};

// Generate Label
export const generateLabel = async (shipment_id: number) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/courier/generate/label',
            { shipment_id: [shipment_id] },
            { headers: getShiprocketHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error generating Shiprocket label:', error);
        throw new Error('Failed to generate Shiprocket label');
    }
};

// Request Pickup
export const requestPickup = async (shipment_id: number) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/courier/generate/pickup',
            { shipment_id: [shipment_id] },
            { headers: getShiprocketHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error requesting pickup:', error);
        throw new Error('Failed to request pickup');
    }
};

// Generate Manifest
export const generateManifest = async (shipment_id: number) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/manifests/generate',
            { shipment_id: [shipment_id] },
            { headers: getShiprocketHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error generating manifest:', error);
        throw new Error('Error generating manifest');
    }
};

// Get Tracking
export const getTracking = async (awb_code: number) => {
    try {
        const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb_code}`, { headers: getShiprocketHeaders() });
        return response.data;
    } catch (error) {
        console.error('Error tracking shipment:', error);
        throw new Error('Failed to track shipment');
    }
};

// Update Shiprocket Order
export const updateShiprocketOrder = async (shipmentId: number, payload: object) => {
    try {
        const response = await axios.post(
            'https://apiv2.shiprocket.in/v1/external/pickups/create',
            { shipment_id: shipmentId, ...payload },
            { headers: getShiprocketHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error updating Shiprocket order:', error);
        throw new Error('Failed to update Shiprocket order');
    }
};