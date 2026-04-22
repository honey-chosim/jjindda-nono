"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  phone: string;
  inviteCode: string;
  realName: string;
  name: string;
  gender: "male" | "female" | "";
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  height: number;
  education: string;
  school: string;
  company: string;
  jobTitle: string;
  residenceCity: string;
  residenceDistrict: string;
  smoking: string;
  drinking: string;
  mbti: string;
  hobbies: string[];
  pet: string;
  preferredAgeMin: number;
  preferredAgeMax: number;
  preferredHeightMin: number;
  preferredResidence: string[];
  preferredFreeText: string;
  bio: string;
  photos: string[];

  setPhone: (phone: string) => void;
  setInviteCode: (code: string) => void;
  setRealName: (realName: string) => void;
  setName: (name: string) => void;
  setGender: (gender: "male" | "female") => void;
  setBirthYear: (year: number) => void;
  setBirthMonth: (month: number) => void;
  setBirthDay: (day: number) => void;
  setHeight: (height: number) => void;
  setEducation: (education: string) => void;
  setSchool: (school: string) => void;
  setCompany: (company: string) => void;
  setJobTitle: (jobTitle: string) => void;
  setResidenceCity: (city: string) => void;
  setResidenceDistrict: (district: string) => void;
  setSmoking: (smoking: string) => void;
  setDrinking: (drinking: string) => void;
  setMbti: (mbti: string) => void;
  toggleHobby: (hobby: string) => void;
  setPet: (pet: string) => void;
  setPreferredAgeMin: (year: number) => void;
  setPreferredAgeMax: (year: number) => void;
  setPreferredHeightMin: (height: number) => void;
  togglePreferredResidence: (city: string) => void;
  setPreferredFreeText: (text: string) => void;
  setBio: (bio: string) => void;
  addPhoto: (photo: string) => void;
  removePhoto: (index: number) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
  phone: "",
  inviteCode: "",
  realName: "",
  name: "",
  gender: "",
  birthYear: 1995,
  birthMonth: 1,
  birthDay: 1,
  height: 0,
  education: "",
  school: "",
  company: "",
  jobTitle: "",
  residenceCity: "",
  residenceDistrict: "",
  smoking: "",
  drinking: "",
  mbti: "",
  hobbies: [],
  pet: "",
  preferredAgeMin: 1990,
  preferredAgeMax: 2002,
  preferredHeightMin: 0,
  preferredResidence: [],
  preferredFreeText: "",
  bio: "",
  photos: [],

  setPhone: (phone) => set({ phone }),
  setInviteCode: (inviteCode) => set({ inviteCode }),
  setRealName: (realName) => set({ realName }),
  setName: (name) => set({ name }),
  setGender: (gender) => set({ gender }),
  setBirthYear: (birthYear) => set({ birthYear }),
  setBirthMonth: (birthMonth) => set({ birthMonth }),
  setBirthDay: (birthDay) => set({ birthDay }),
  setHeight: (height) => set({ height }),
  setEducation: (education) => set({ education }),
  setSchool: (school) => set({ school }),
  setCompany: (company) => set({ company }),
  setJobTitle: (jobTitle) => set({ jobTitle }),
  setResidenceCity: (residenceCity) => set({ residenceCity }),
  setResidenceDistrict: (residenceDistrict) => set({ residenceDistrict }),
  setSmoking: (smoking) => set({ smoking }),
  setDrinking: (drinking) => set({ drinking }),
  setMbti: (mbti) => set({ mbti }),
  toggleHobby: (hobby) =>
    set((state) => ({
      hobbies: state.hobbies.includes(hobby)
        ? state.hobbies.filter((h) => h !== hobby)
        : state.hobbies.length < 5
        ? [...state.hobbies, hobby]
        : state.hobbies,
    })),
  setPet: (pet) => set({ pet }),
  setPreferredAgeMin: (preferredAgeMin) => set({ preferredAgeMin }),
  setPreferredAgeMax: (preferredAgeMax) => set({ preferredAgeMax }),
  setPreferredHeightMin: (preferredHeightMin) => set({ preferredHeightMin }),
  togglePreferredResidence: (city) =>
    set((state) => ({
      preferredResidence: state.preferredResidence.includes(city)
        ? state.preferredResidence.filter((c) => c !== city)
        : [...state.preferredResidence, city],
    })),
  setPreferredFreeText: (preferredFreeText) => set({ preferredFreeText }),
  setBio: (bio) => set({ bio }),
  addPhoto: (photo) =>
    set((state) => ({
      photos: state.photos.length < 5 ? [...state.photos, photo] : state.photos,
    })),
  removePhoto: (index) =>
    set((state) => ({
      photos: state.photos.filter((_, i) => i !== index),
    })),
    }),
    { name: "jjindda-onboarding" }
  )
);
