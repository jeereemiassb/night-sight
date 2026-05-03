# NightSight

NightSight is a local stack for searching a people directory by name or by face image. Includes FastAPI for the backend, InsightFace for detection and embeddings, FAISS for vector search over the embeddings, and React in the frontend.

For face search, the index script loads the configured photo field, detects faces with InsightFace, stores normalized embeddings in a FAISS index and writes matching labels. At runtime, the recognition endpoint extracts an embedding from the uploaded image, searches the FAISS index for the closest vectors, applies the configured threshold, and returns the best match plus similar candidates.

<img width="755" height="370" alt="Preview-1" src="https://github.com/user-attachments/assets/49d907fb-28e2-49d5-866b-7a77af76c09d" />

## Requirements

Bring some people's data to get started. At first you just need a name and a photo, but you can add whatever you have. If you don't have any you can try [Labelled Faces in the Wild](https://www.kaggle.com/datasets/jessicali9530/lfw-dataset). I provide a modified version of it in demo/ with its vectors and labels.

The db needs a "photo" field, it could a base64 encoded picture or the path in the system.

Edit [config/data_source.toml](./config/data_source.toml) to match your visible fields, db name and searching options.

## Quickstart

If you want to use the demo data just modify the docker-compose environment config path to [demo/config/data_source.toml](.demo/config/data_source.toml).

Else:

1. Put your SQLite file in `data/`.
2. Edit [config/data_source.toml](./config/data_source.toml).
3. Extract your embeddings:

```bash
python3 -m scripts.build_face_index
```

4. Start the stack:

```bash
docker compose up --build
```


## Configuring a new database

The main setup step is the `people_query` inside `config/data_source.toml`.

Example:

```toml
[data_source]
db_path = "../data/company_people.db"
people_query = """
SELECT
  employee_id AS person_id,
  full_name AS display_name,
  photo_base64 AS photo_base64,
  employee_id AS employee_id,
  email AS email,
  department AS department,
  status AS status
FROM employees
"""
```

Then define which extra aliases the frontend should display:

```toml
[[fields]]
key = "employee_id"
label = "Employee ID"
default_visible = true
icon = "database"

[[fields]]
key = "department"
label = "Department"
default_visible = true
icon = "building"
```

<img width="755" height="368" alt="Preview-2" src="https://github.com/user-attachments/assets/38bc48f5-6ef2-4d92-a654-39d4e334ba95" />
