import {ref, onMounted, watch} from 'vue';
import { isPlatform } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
const photos = ref<UserPhoto[]>([]);

// Watch for changes to the photos array and cache any new photos
const PHOTO_STORAGE = 'photos';

const cachePhotos = () => {
  Storage.set({
    key: PHOTO_STORAGE,
    value: JSON.stringify(photos.value),
  });
};

watch(photos, cachePhotos);

// Helper converting blobs to base64
const convertBlobToBase64 = (blob: Blob) =>
  new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    resolve(reader.result);
  };
  reader.readAsDataURL(blob);  
});

const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
  let base64Data: string;

  // Check platform - 'hybrid' is iOS or Android
  if (isPlatform('hybrid')){
    const file = await Filesystem.readFile({
      path: photo.path!,
    });
    base64Data = file.data;
  } else {
    // Fetch the photo, read as a blob, then convert to base64
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    base64Data = (await convertBlobToBase64(blob)) as string; 
  }
   
  const savedFile = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Data,
  });
  
  if (isPlatform('hybrid')) {
  // Display new image by writing the 'file://' path to HTTP
    return {
      filepath: savedFile.uri,
      webviewPath: Capacitor.convertFileSrc(savedFile.uri),
    };
  } else {
    // Display the photo using webpath rather than base64 since it's
    // already in memory
    return {
      filepath: fileName,
      webviewPath: photo.webPath,
    };
  }
};

// Load photos from storage
const loadSaved = async () => {
  const photoList = await Storage.get({key: PHOTO_STORAGE});
  const photosInStorage = photoList.value ? JSON.parse(photoList.value) : [];

  // If running on the web...
  if (!isPlatform('hybrid')) {
    for (const photo of photosInStorage){
      const file = await Filesystem.readFile({
        path: photo.filepath,
        directory: Directory.Data,
      });
      photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
    }
  }

  photos.value = photosInStorage;
};


export function usePhotoGallery() {
  onMounted(loadSaved);
  const takePhoto = async () => {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });
    const fileName = new Date().getTime() + '.jpeg';
    const savedFileImage = await savePicture(photo, fileName);

    photos.value = [savedFileImage, ...photos.value];
  };


  return {
    photos,
    takePhoto,
  };
}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}
