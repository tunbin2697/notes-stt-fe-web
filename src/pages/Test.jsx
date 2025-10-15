import { useState } from "react";
import { startMic, stopMic } from "@/services/AudioContext";

export default function Test() {
  const [response, setResponse] = useState("");

  const callApi = async () => {
    const email = "tunbin2697@gmail.com";
    const password = "khang177";
    const query = `
      query GetMyNotes {
        getMyNotes(
          limit: 20
          offset: 0
        ) {
          nodes {
            id
            title
            content
            type
            status
            priority
            dueDate
            tags
            color
            isPinned
            isArchived
            createdAt
            updatedAt
          }
          totalCount
          hasMore
          nextCursor
          pageInfo {
            limit
            offset
            currentPage
            totalPages
          }
        }
      }
    `;
    const variables = { email, password };

    fetch("http://localhost:3000/graphql", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTc2MDU1MDQ0NSwiZXhwIjoxNzYwNTUxMzQ1LCJhdWQiOiJkcGwtbm90ZS1hcGkiLCJpc3MiOiJkcGwtbm90ZS1hcHAifQ.2U4KdIH14iTZwZapQccHIbKtrhrp5UcYINxEwcw3ojw`,
      },
      body: JSON.stringify({ query, variables }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Test Page</h1>
      <p className="text-gray-700">
        This is a test page for various components.
      </p>
      <button
        onClick={() =>
          startMic((chunk) => {
            console.log("Mic chunk:", chunk);
          })
        }
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Start Mic
      </button>
      <button
        onClick={stopMic}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Stop Mic
      </button>
      <div className="mt-6 p-4 border rounded bg-white w-3/4">
        <button
          onClick={callApi}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          call api
        </button>
        <p className="mt-2 text-gray-600">{response}</p>
      </div>
    </div>
  );
}
