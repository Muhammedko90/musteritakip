import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC7vjIG9uj_QOjjcZku_EkGvYWwF4FZYl8",
    authDomain: "musteritakipapp-5c51e.firebaseapp.com",
    projectId: "musteritakipapp-5c51e",
    storageBucket: "musteritakipapp-5c51e.firebasestorage.app",
    messagingSenderId: "515056426916",
    appId: "1:515056426916:web:e852d50a551c29b1dc6b31"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);